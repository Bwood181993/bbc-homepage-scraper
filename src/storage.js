/**
 * JSON Storage Module
 * Handles saving results to JSON file
 */

import fs from 'fs';
import config from '../config.js';
import path from 'path';

export function cleanupPreviousRun() {
    console.log('Cleaning up previous run data...');

    // Clear screenshots folder
    const screenshotsDir = config.output.screenshotsDir;
    if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir);
        for (const file of files) {
            fs.unlinkSync(path.join(screenshotsDir, file));
        }
    }

    // Clear results file
    const resultsFile = config.output.resultsFile;
    if (fs.existsSync(resultsFile)) {
        fs.unlinkSync(resultsFile);
    }
}

/**
 * Initialize results file if it doesn't exist
 */
export function initResultsFile() {
    const filePath = config.output.resultsFile;

    if (!fs.existsSync(filePath)) {
        const initialData = {
            metadata: {
                createdAt: new Date().toISOString(),
            },
            failed: [],
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
export function loadResults() {
    initResultsFile();
    const data = fs.readFileSync(config.output.resultsFile, 'utf8');
    return JSON.parse(data);
}

/**
 * Save result for a single snapshot
 * @param {object} result - Result object to save
 */
export function saveResult(result) {
    const data = loadResults();

    // Check if result for this timestamp already exists
    const existingIndex = data.results.findIndex((r) => r.timestamp === result.timestamp);

    if (existingIndex >= 0) {
        // Update existing result
        data.results[existingIndex] = result;
    } else {
        // Add new result
        data.results.push(result);
    }

    // Update metadata
    data.metadata.totalSnapshots = data.results.length;

    fs.writeFileSync(config.output.resultsFile, JSON.stringify(data, null, 2));
}

export function saveFailedRun(details) {
    const data = loadResults();

    // Check if result for this timestamp already exists
    const existingIndex = data.failed.findIndex((r) => r.timestamp === details[0]);

    if (existingIndex >= 0) {
        // Update existing result
        data.failed[existingIndex] = details;
    } else {
        // Add new result
        data.failed.push(details);
    }

    fs.writeFileSync(config.output.resultsFile, JSON.stringify(data, null, 2));
}

/**
 * Get summary statistics
 * @returns {{ total: number, successful: number, failed: number }}
 */
export function getStats() {
    const data = loadResults();
    const successful = data.results.length;
    const failed = data.failed.length;

    return {
        total: successful + failed,
        successful,
        failed,
    };
}
