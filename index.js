/**
 * BBC Historical Homepage Scraper
 * Main entry point
 *
 */
import config from './config.js';
import { fetchSnapshots } from'./src/wayback.js';
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
    const year = parseInt(date.split('-')[0]);
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
    let startDate = null;
    let endDate = null;

    // Validate start date
    if (args[0] && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
        startDate = args[0];
    } else {
        console.log('No valid date provided. Exiting.');
        process.exit(1);
    }

    if (args[1] && /^\d{4}-\d{2}-\d{2}$/.test(args[1])) {
        if (new Date(args[1]) <= new Date(args[0])) {
            console.log('Invalid date range. Proceeding in single date mode.');
        } else {
            endDate = args[1];
        }
    }

    return [startDate, endDate];
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

    // Validate
    const [startDate, endDate] = validateInputs(args);

    // Setup
    cleanupPreviousRun();
    initResultsFile();

    // Fetch available snapshots
    let snapshots;
    try {
        snapshots = await fetchSnapshots(startDate, endDate);
        // snapshots = await fetchSnapshots();
    } catch (error) {
        console.error('Failed to fetch snapshots. Exiting.', error.message);
        process.exit(1);
    }

    if (snapshots.length === 0) {
        console.log('No snapshots to process. Exiting.');
        process.exit(0);
    }


    // Process snapshots
    let successCount = 0;
    let failCount = 0;

    console.log(`  Snapshots to process: ${snapshots.length}`);
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

            // Save a failed result
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
