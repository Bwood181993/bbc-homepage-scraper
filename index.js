/**
 * BBC Historical Homepage Scraper
 * Main entry point
 *
 */
import config from './config.js';
import { fetchSnapshots, fetchSnapshotForDate } from'./src/wayback.js';
import { captureScreenshotFromPage, getPage, closeBrowser } from'./src/screenshot.js';
import { extractHeadlineLinks } from'./src/linkExtractor.js';
import {cleanupPreviousRun, initResultsFile, saveResult, getStats, saveFailedRun} from './src/storage.js';


/**
 * Sleep for specified milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a single snapshot
 * @param {object} snapshot - Snapshot data
 * @returns {Promise<object>} - Result object
 */
async function processSnapshot(snapshot) {
    const { timestamp, date, archiveUrl } = snapshot;

    console.log(`\nProcessing: ${date} (${timestamp})`);

    // Extract year from date (yyyy-mm-dd format)
    const year = parseInt(date.split('-')[0], 10);

    // Get page instance (loads page once for both extraction and screenshot)
    const { page, error: pageError, partial } = await getPage(archiveUrl);

    let extraction;
    let screenshotResult;

    if (page) {
        // Wait for page to render if delay configured
        const extractionDelay = config.puppeteer.extractionDelay;
        if (extractionDelay > 0) {
            console.log(`  Waiting ${extractionDelay}ms for page to render...`);
            await sleep(extractionDelay);
        }

        // FIRST: Extract links
        console.log('Extracting links...');
        extraction = await extractHeadlineLinks(page, year);
        extraction.partial = partial;

        // If extraction failed, retry after more rendering time
        if (!extraction.success) {
            console.log('  Retrying link extraction after additional delay...');
            await sleep(2500);
            extraction = await extractHeadlineLinks(page, year);
            extraction.partial = partial;
        }

        // THEN: Take screenshot (after extraction is complete)
        if (config.enableScreenshots) {
            screenshotResult = await captureScreenshotFromPage(page, date);
        }

        await page.close();
    } else {
        extraction = {
            success: false,
            links: [],
            reason: `page_load_failed: ${pageError}`,
            selectorUsed: null,
            partial: false,
        };
        screenshotResult = false;
    }

    return {
        [date]: {
            success: true,
            timestamp,
            archiveUrl,
            screenshotSuccess: screenshotResult.success,
            links: extraction.links,
        }
    };
}

const validateInputs = (args) => {
    const startDate = args[0];
    const endDate = args[1];

    // Validate start date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
        console.log('No valid dates provided. Exiting.');
        process.exit(1);
    }

    return startDate;
}


/**
 * Main scraper function
 */
async function main() {
    console.log('--- Scraper Startup ---');
    const scraperStart = Date.now();

    // Check for arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        return console.log('No arguments provided. Exiting.');
    }
    if (args.length === 1) {
        console.log(`Single date mode: ${args[0]}\n`);
    }
    if (args.length > 1) {
        console.log('Multiple dates mode:');
        args.forEach((arg) => console.log(`  ${arg}`));
    }

    // 5. Run Scrape for each date in date range
        // a. Fetch Snapshots
        // b. Process Snapshots
        // c. Print screenshots
    // 6. Print Results
    // 7. Shut down
    // return;

    // Validate
    // TODO - add end date validation and retrieval here
    const startDate = validateInputs(args);

    cleanupPreviousRun();  // Clean up previous data
    initResultsFile(); // Initialize results file

    // Fetch available snapshots
    let snapshots;
    try {
        snapshots = await fetchSnapshotForDate(startDate);
        // snapshots = await fetchSnapshots();
    } catch (error) {
        console.error('Failed to fetch snapshots. Exiting.');
        process.exit(1);
    }

    if (snapshots.length === 0) {
        console.log('No snapshots to process. Exiting.');
        process.exit(0);
    }

    console.log(`\nConfiguration:`);
    console.log(`  Rate limit delay: ${config.rateLimitDelay}ms`);
    console.log(`  Snapshots to process: ${snapshots.length}`);
    console.log(`  Output: ${config.output.resultsFile}`);
    console.log(`  Screenshots: ${config.output.screenshotsDir}/`);

    console.log('Snapshots', snapshots);
    // return;

    // Process snapshots
    let successCount = 0;
    let failCount = 0;

    console.log(`\n--- Starting scrape of ${snapshots.length} snapshot(s) ---\n`);

    for (let i = 0; i < snapshots.length; i++) {
        const snapshot = snapshots[i];

        try {
            const result = await processSnapshot(snapshot);

            // Save result
            saveResult(result);
            const resultDetails = result[snapshot.date];

            if (resultDetails.success) {
                successCount++;
                console.log(`  ✓ Extracted ${resultDetails.links.length} links`);
            } else {
                failCount++;
                console.log(`  ✗ Extraction failed: ${resultDetails.reason}`);
            }

            // Progress update
            const progress = (((i + 1) / snapshots.length) * 100).toFixed(1);
            console.log(`  Progress: ${i + 1}/${snapshots.length} (${progress}%)`);

            // Rate limiting (skip delay on last item)
            if (i < snapshots.length - 1) {
                console.log(`  Waiting ${config.rateLimitDelay}ms...`);
                await sleep(config.rateLimitDelay);
            }
        } catch (error) {
            console.error(`  Error processing snapshot ${snapshot.timestamp}:`, error.message);
            failCount++;

            // Save failed result
            const failedResult = {
                [snapshot.date]: {
                    archiveUrl: snapshot.archiveUrl,
                    timestamp: snapshot.timestamp,
                    msg: `Error: ${error.message}`,
                },
            };
            saveFailedRun(failedResult);

            // Continue to next snapshot instead of aborting
            await sleep(config.rateLimitDelay);
        }
    }

    // Close browser
    await closeBrowser();

    // Final summary
    console.log('---Scrape Complete---');

    // @TODO - extract out this calculation
    const scraperEnd = Date.now();
    const durationMs = scraperEnd - scraperStart;
    const durationSec = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const stats = getStats();
    console.log(`\nResults:`);
    console.log(`  Total snapshots processed: ${stats.total}`);
    console.log(`  Successful extractions: ${stats.successful}`);
    console.log(`  Failed extractions: ${stats.failed}`);
    console.log(`  Duration: ${durationStr}`);
    console.log(`\nOutput saved to: ${config.output.resultsFile}`);
    console.log(`Screenshots saved to: ${config.output.screenshotsDir}/`);

    if (stats.failed > 0) {
        console.log(`\nNote: ${stats.failed} snapshot(s) failed extraction.`);
        console.log('Review screenshots to manually verify these results.');
    }
}

// Run main function
main().catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
});
