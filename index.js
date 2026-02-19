/**
 * BBC Historical Homepage Scraper
 * Main entry point
 *
 * Usage:
 *   npm start           - Start fresh or prompt to resume
 *   npm run start:resume - Auto-resume from checkpoint
 */
const config = require('./config');
const { fetchSnapshots } = require('./src/wayback');
const { captureScreenshot, getPage, closeBrowser } = require('./src/screenshot');
const { extractHeadlineLinks } = require('./src/linkExtractor');
const { initResultsFile, saveResult, getStats } = require('./src/storage');
const {
  loadCheckpoint,
  saveCheckpoint,
  createCheckpoint,
  updateCheckpoint,
  clearCheckpoint,
  getResumeIndex,
  displayCheckpointInfo,
} = require('./src/checkpoint');

const readline = require('readline');

/**
 * Prompt user for input
 * @param {string} question
 * @returns {Promise<string>}
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
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

  // Capture screenshot
  const screenshotResult = await captureScreenshot(archiveUrl, timestamp);

  // Get page for link extraction
  const { page, error: pageError, partial } = await getPage(archiveUrl);

  let extraction;

  if (page) {
    extraction = await extractHeadlineLinks(page);
    extraction.partial = partial; // Track if this was from a partial page load
    await page.close();
  } else {
    extraction = {
      success: false,
      links: [],
      selectorUsed: null,
      reason: `page_load_failed: ${pageError}`,
      partial: false,
    };
  }

  const result = {
    date,
    timestamp,
    archiveUrl,
    screenshotPath: screenshotResult.screenshotPath,
    screenshotSuccess: screenshotResult.success,
    screenshotError: screenshotResult.error,
    screenshotPartial: screenshotResult.partial || false,
    extraction,
  };

  return result;
}

/**
 * Main scraper function
 */
async function main() {
  console.log('=================================');
  console.log('  BBC Historical Homepage Scraper');
  console.log('=================================\n');

  // Check for --resume flag
  const args = process.argv.slice(2);
  const autoResume = args.includes('--resume');

  // Check for existing checkpoint
  const { exists: checkpointExists, data: checkpointData } = loadCheckpoint();

  let startIndex = 0;

  if (checkpointExists) {
    displayCheckpointInfo();

    if (autoResume) {
      console.log('Auto-resuming from checkpoint...\n');
      startIndex = checkpointData.lastProcessedIndex + 1;
    } else {
      const answer = await prompt('Resume from checkpoint? (y/n): ');

      if (answer === 'y' || answer === 'yes') {
        startIndex = checkpointData.lastProcessedIndex + 1;
        console.log(`Resuming from snapshot ${startIndex + 1}...\n`);
      } else {
        console.log('Starting fresh...\n');
        clearCheckpoint();
      }
    }
  }

  // Initialize results file
  initResultsFile();

  // Fetch available snapshots
  let snapshots;
  try {
    snapshots = await fetchSnapshots();
  } catch (error) {
    console.error('Failed to fetch snapshots. Exiting.');
    process.exit(1);
  }

  if (snapshots.length === 0) {
    console.log('No snapshots to process. Exiting.');
    process.exit(0);
  }

  // Create checkpoint if starting fresh
  if (startIndex === 0) {
    saveCheckpoint(createCheckpoint(snapshots));
  }

  console.log(`\nConfiguration:`);
  console.log(`  Rate limit delay: ${config.rateLimitDelay}ms`);
  console.log(`  Starting from: snapshot ${startIndex + 1} of ${snapshots.length}`);
  console.log(`  Output: ${config.output.resultsFile}`);
  console.log(`  Screenshots: ${config.output.screenshotsDir}/`);

  // Process snapshots
  const totalToProcess = snapshots.length - startIndex;
  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;

  console.log(`\n--- Starting scrape of ${totalToProcess} snapshot(s) ---\n`);

  for (let i = startIndex; i < snapshots.length; i++) {
    const snapshot = snapshots[i];

    try {
      const result = await processSnapshot(snapshot);

      // Save result
      saveResult(result);

      // Update checkpoint
      updateCheckpoint(i, snapshot.timestamp, snapshots.length);

      processedCount++;

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
        screenshotError: error.message,
        extraction: {
          success: false,
          links: [],
          selectorUsed: null,
          reason: `processing_error: ${error.message}`,
        },
      };
      saveResult(failedResult);
      updateCheckpoint(i, snapshot.timestamp, snapshots.length);

      // Continue to next snapshot instead of aborting
      await sleep(config.rateLimitDelay);
    }
  }

  // Close browser
  await closeBrowser();

  // Clear checkpoint on successful completion
  clearCheckpoint();

  // Final summary
  console.log('\n=================================');
  console.log('         Scrape Complete!');
  console.log('=================================');

  const stats = getStats();
  console.log(`\nResults:`);
  console.log(`  Total snapshots processed: ${stats.total}`);
  console.log(`  Successful extractions: ${stats.successful}`);
  console.log(`  Failed extractions: ${stats.failed}`);
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

