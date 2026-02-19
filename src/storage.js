/**
 * JSON Storage Module
 * Handles saving results to JSON file
 */
const fs = require('fs');
const config = require('../config');

/**
 * Initialize results file if it doesn't exist
 */
function initResultsFile() {
  const filePath = config.output.resultsFile;

  if (!fs.existsSync(filePath)) {
    const initialData = {
      metadata: {
        createdAt: new Date().toISOString(),
        description: 'BBC Historical Homepage Scraper Results',
      },
      results: [],
    };
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    console.log(`Created results file: ${filePath}`);
  }
}

/**
 * Load existing results from file
 * @returns {{ metadata: object, results: Array }}
 */
function loadResults() {
  initResultsFile();
  const data = fs.readFileSync(config.output.resultsFile, 'utf8');
  return JSON.parse(data);
}

/**
 * Save result for a single snapshot
 * @param {object} result - Result object to save
 */
function saveResult(result) {
  const data = loadResults();

  // Check if result for this timestamp already exists
  const existingIndex = data.results.findIndex(r => r.timestamp === result.timestamp);

  if (existingIndex >= 0) {
    // Update existing result
    data.results[existingIndex] = result;
  } else {
    // Add new result
    data.results.push(result);
  }

  // Update metadata
  data.metadata.lastUpdated = new Date().toISOString();
  data.metadata.totalSnapshots = data.results.length;

  fs.writeFileSync(config.output.resultsFile, JSON.stringify(data, null, 2));
}

/**
 * Get all saved results
 * @returns {Array}
 */
function getResults() {
  const data = loadResults();
  return data.results;
}

/**
 * Check if a timestamp has already been processed
 * @param {string} timestamp
 * @returns {boolean}
 */
function isProcessed(timestamp) {
  const results = getResults();
  return results.some(r => r.timestamp === timestamp);
}

/**
 * Get summary statistics
 * @returns {{ total: number, successful: number, failed: number }}
 */
function getStats() {
  const results = getResults();
  const successful = results.filter(r => r.extraction?.success).length;
  const failed = results.filter(r => !r.extraction?.success).length;

  return {
    total: results.length,
    successful,
    failed,
  };
}

module.exports = {
  initResultsFile,
  loadResults,
  saveResult,
  getResults,
  isProcessed,
  getStats,
};

