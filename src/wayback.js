/**
 * Wayback Machine API Integration
 * Fetches historical snapshots of BBC homepage
 */

import axios from 'axios';
import config from '../config.js';

const CDX_API_URL = 'https://web.archive.org/cdx/search/cdx';
const ARCHIVE_URL_BASE = 'https://web.archive.org/web';
const TARGET_URL = 'https://www.bbc.co.uk/';

/**
 * Randomly sample items from an array
 * @param {Array} array - Array to sample from
 * @param {number} count - Number of items to sample
 * @returns {Array} - Randomly sampled items
 */
function randomSample(array, count) {
    if (count >= array.length) {
        return array;
    }

    // Fisher-Yates shuffle and take first 'count' items
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return sampled items sorted by date
    return shuffled.slice(0, count).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}


/**
 * Fetch available snapshots from Wayback Machine CDX API
 * @returns {Promise<Array<{ timestamp: string, archiveUrl: string, date: string }>>}
 */
export async function fetchSnapshots(startDate, endDate) {
    console.log('Fetching snapshots...');
    const randomMode = config.randomMode;
    const randomCount = config.randomCount;
    const hasEndDate = endDate !== null;

    const params = {
        url: TARGET_URL,
        output: 'json',
        from: startDate.replace(/-/g, ''),
        to: hasEndDate ? endDate.replace(/-/g, '') : startDate.replace(/-/g, ''),
        filter: 'statuscode:200',
        collapse: 'timestamp:8', // One snapshot per day
    };

    try {
        const response = await axios.get(CDX_API_URL, { params });
        const data = response.data;

        if (!data || data.length < 2) {
            console.log('No snapshots found for the specified date range.');
            return [];
        }

        // First row is headers, rest are data
        const headers = data[0];
        const timestampIndex = headers.indexOf('timestamp');

        let snapshots = data.slice(1).map((row) => {
            const timestamp = row[timestampIndex];
            const dateStr = timestamp.slice(0, 4) + '-' + timestamp.slice(4, 6) + '-' + timestamp.slice(6, 8);

            return {
                timestamp,
                date: dateStr,
                archiveUrl: `${ARCHIVE_URL_BASE}/${timestamp}/${TARGET_URL}`,
            };
        });

        console.log(`Found ${snapshots.length} total snapshot(s).`);

        // Apply random sampling if configured
        if (randomMode && randomCount && randomCount > 0) {
            snapshots = randomSample(snapshots, randomCount);
            console.log(`Randomly selected ${snapshots.length} snapshot(s) for processing.`);
        }

        return snapshots;
    } catch (error) {
        console.error('Error fetching snapshots from Wayback Machine:', error.message);
        throw error;
    }
}
