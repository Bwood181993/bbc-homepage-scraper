/**
 * BBC Historical Homepage Scraper
 * Main entry point
 *
 * Usage:
 ing 8000m *   npm start                    - Analyse random dates from configured year
 *   node index.js 2021-08-14     - Analyse a specific date
 */
const config = require('./config');
const { fetchSnapshots, fetchSnapshotForDate } = require('./src/wayback');
const { captureScreenshotFromPage, getPage, closeBrowser } = require('./src/screenshot');
const { extractHeadlineLinks } = require('./src/linkExtractor');
const { initResultsFile, saveResult, getStats } = require('./src/storage');

const fs = require('fs');
const path = require('path');

/**
 * Clean up previous run data (screenshots and results)
 */
function cleanupPreviousRun() {
  console.log('Cleaning up previous run data...');

  // Clear screenshots folder
  const screenshotsDir = config.output.screenshotsDir;
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    for (const file of files) {
      fs.unlinkSync(path.join(screenshotsDir, file));
    }
    console.log(`  Cleared ${files.length} screenshot(s)`);
  }

  // Clear results file
  const resultsFile = config.output.resultsFile;
  if (fs.existsSync(resultsFile)) {
    fs.unlinkSync(resultsFile);
    console.log('  Cleared results.json');
  }

  console.log('');
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    console.log('  Extracting links...');
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
    screenshotResult = await captureScreenshotFromPage(page, date);

    await page.close();
  } else {
    extraction = {
      success: false,
      links: [],
      selectorUsed: null,
      reason: `page_load_failed: ${pageError}`,
      partial: false,
    };
    screenshotResult = {
      success: false,
      screenshotPath: null,
      error: pageError,
    };
  }

  return {
    date,
    timestamp,
    archiveUrl,
    screenshotPath: screenshotResult.screenshotPath,
    screenshotSuccess: screenshotResult.success,
    extraction,
  };
}

/**
 * Main scraper function
 */
async function main() {
  const startTime = Date.now();

  console.log('=================================');
  console.log('  BBC Historical Homepage Scraper');
  console.log('=================================\n');

  // Check for arguments
  const args = process.argv.slice(2);

  // Check for specific date parameter (yyyy-mm-dd format)
  const dateArg = args.find(arg => /^\d{4}-\d{2}-\d{2}$/.test(arg));

  if (dateArg) {
    console.log(`Single date mode: ${dateArg}\n`);
  }

  // Clean up previous data
  cleanupPreviousRun();

  // Initialize results file
  initResultsFile();

  // Fetch available snapshots
  let snapshots;
  try {
    if (dateArg) {
      snapshots = await fetchSnapshotForDate(dateArg);
    } else {
      snapshots = await fetchSnapshots();
    }
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

      if (result.extraction.success) {
        successCount++;
        console.log(`  ✓ Extracted ${result.extraction.links.length} links`);
      } else {
        failCount++;
        console.log(`  ✗ Extraction failed: ${result.extraction.reason}`);
      }

      // Progress update
      const progress = ((i + 1) / snapshots.length * 100).toFixed(1);
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
        date: snapshot.date,
        timestamp: snapshot.timestamp,
        archiveUrl: snapshot.archiveUrl,
        screenshotPath: null,
        screenshotSuccess: false,
        extraction: {
          success: false,
          links: [],
          selectorUsed: null,
          reason: `processing_error: ${error.message}`,
        },
      };
      saveResult(failedResult);

      // Continue to next snapshot instead of aborting
      await sleep(config.rateLimitDelay);
    }
  }

  // Close browser
  await closeBrowser();


  // Final summary
  console.log('\n=================================');
  console.log('         Scrape Complete!');
  console.log('=================================');

  const endTime = Date.now();
  const durationMs = endTime - startTime;
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
main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
