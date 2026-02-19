/**
 * Checkpoint Module
 * Handles save/resume functionality for long-running scrape campaigns
 */
const fs = require('fs');
const config = require('../config');

/**
 * Load checkpoint from file
 * @returns {{ exists: boolean, data: object | null }}
 */
function loadCheckpoint() {
  const filePath = config.checkpoint.filePath;

  if (!fs.existsSync(filePath)) {
    return { exists: false, data: null };
  }

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const checkpoint = JSON.parse(data);
    return { exists: true, data: checkpoint };
  } catch (error) {
    console.error('Error loading checkpoint:', error.message);
    return { exists: false, data: null };
  }
}

/**
 * Save checkpoint to file
 * @param {object} checkpointData - Checkpoint data to save
 */
function saveCheckpoint(checkpointData) {
  const filePath = config.checkpoint.filePath;

  const checkpoint = {
    ...checkpointData,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
}

/**
 * Create initial checkpoint for a new campaign
 * @param {Array} snapshots - All snapshots to process
 * @returns {object}
 */
function createCheckpoint(snapshots) {
  return {
    totalSnapshots: snapshots.length,
    processedCount: 0,
    lastProcessedIndex: -1,
    lastProcessedTimestamp: null,
    startedAt: new Date().toISOString(),
    snapshotTimestamps: snapshots.map(s => s.timestamp),
  };
}

/**
 * Update checkpoint after processing a snapshot
 * @param {number} index - Index of processed snapshot
 * @param {string} timestamp - Timestamp of processed snapshot
 * @param {number} total - Total snapshots
 */
function updateCheckpoint(index, timestamp, total) {
  const { data: existingCheckpoint } = loadCheckpoint();

  const checkpoint = {
    ...(existingCheckpoint || {}),
    totalSnapshots: total,
    processedCount: index + 1,
    lastProcessedIndex: index,
    lastProcessedTimestamp: timestamp,
  };

  // Only save at intervals defined in config (or always if interval is 1)
  if ((index + 1) % config.checkpoint.saveInterval === 0) {
    saveCheckpoint(checkpoint);
  }
}

/**
 * Clear checkpoint file (call on successful completion)
 */
function clearCheckpoint() {
  const filePath = config.checkpoint.filePath;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('Checkpoint cleared - campaign completed successfully.');
  }
}

/**
 * Get resume index from checkpoint
 * @returns {number} - Index to resume from (-1 if starting fresh)
 */
function getResumeIndex() {
  const { exists, data } = loadCheckpoint();

  if (!exists || !data) {
    return -1;
  }

  return data.lastProcessedIndex;
}

/**
 * Display checkpoint info
 */
function displayCheckpointInfo() {
  const { exists, data } = loadCheckpoint();

  if (!exists) {
    console.log('No existing checkpoint found. Starting fresh.\n');
    return;
  }

  console.log('\n=== Checkpoint Found ===');
  console.log(`Started at: ${data.startedAt}`);
  console.log(`Last saved: ${data.savedAt}`);
  console.log(`Progress: ${data.processedCount}/${data.totalSnapshots} snapshots`);
  console.log(`Last processed: ${data.lastProcessedTimestamp}`);
  console.log('========================\n');
}

module.exports = {
  loadCheckpoint,
  saveCheckpoint,
  createCheckpoint,
  updateCheckpoint,
  clearCheckpoint,
  getResumeIndex,
  displayCheckpointInfo,
};

