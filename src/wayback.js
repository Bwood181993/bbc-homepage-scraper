/**
 * Wayback Machine API Integration
 * Fetches historical snapshots of BBC homepage
 */

import axios from 'axios';

const CDX_API_URL = 'https://web.archive.org/cdx/search/cdx';
const ARCHIVE_URL_BASE = 'https://web.archive.org/web';
const TARGET_URL = 'https://www.bbc.co.uk/';

/**
 * Format date as YYYYMMDD for Wayback Machine API
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Calculate date range based on config
 * @returns {{ startDate: string, endDate: string }}
 */
function getDateRange(startDate, endDate) {
    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    };
}

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
 * Fetch snapshot for a specific date
 * @param {string} dateStr - Date in yyyy-mm-dd format
 * @returns {Promise<Array<{ timestamp: string, archiveUrl: string, date: string }>>}
 */
export async function fetchSnapshotForDate(dateStr) {
    // Convert yyyy-mm-dd to yyyymmdd
    const dateForApi = dateStr.replace(/-/g, '');

    console.log(`Fetching snapshot for ${dateStr}...`);

    const params = {
        url: TARGET_URL,
        output: 'json',
        from: dateForApi,
        to: dateForApi,
        filter: 'statuscode:200',
        limit: 1,
    };

    try {
        const response = await axios.get(CDX_API_URL, { params });
        const data = response.data;

        if (!data || data.length < 2) {
            console.log(`No snapshot found for ${dateStr}.`);
            return [];
        }

        const headers = data[0];
        const timestampIndex = headers.indexOf('timestamp');
        const row = data[1];
        const timestamp = row[timestampIndex];

        const snapshot = {
            timestamp,
            date: dateStr,
            archiveUrl: `${ARCHIVE_URL_BASE}/${timestamp}/${TARGET_URL}`,
        };

        console.log(`Found snapshot for ${dateStr}.`);
        return [snapshot];
    } catch (error) {
        console.error('Error fetching snapshot from Wayback Machine:', error.message);
        throw error;
    }
}

/**
 * Fetch available snapshots from Wayback Machine CDX API
 * @returns {Promise<Array<{ timestamp: string, archiveUrl: string, date: string }>>}
 */
export async function fetchSnapshots() {
    const { startDate, endDate } = getDateRange();
    const sampleCount = 15;

    console.log(`Fetching snapshots from ${startDate} to ${endDate}...`);

    const params = {
        url: TARGET_URL,
        output: 'json',
        from: startDate,
        to: endDate,
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
            const dateStr = timestamp.slice(0, 8);
            const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

            return {
                timestamp,
                date: formattedDate,
                archiveUrl: `${archiveUrlBase}/${timestamp}/${targetUrl}`,
            };
        });

        console.log(`Found ${snapshots.length} total snapshot(s).`);

        // Apply random sampling if configured
        if (sampleCount && sampleCount > 0) {
            snapshots = randomSample(snapshots, sampleCount);
            console.log(`Randomly selected ${snapshots.length} snapshot(s) for processing.`);
        }

        return snapshots;
    } catch (error) {
        console.error('Error fetching snapshots from Wayback Machine:', error.message);
        throw error;
    }
}
