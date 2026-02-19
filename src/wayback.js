/**
 * Wayback Machine API Integration
 * Fetches historical snapshots of BBC homepage
 */
const axios = require('axios');
const config = require('../config');

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
function getDateRange() {
  const { dateRange } = config;

  if (dateRange.startDate && dateRange.endDate) {
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange.daysBack);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

/**
 * Fetch available snapshots from Wayback Machine CDX API
 * @returns {Promise<Array<{ timestamp: string, archiveUrl: string, date: string }>>}
 */
async function fetchSnapshots() {
  const { startDate, endDate } = getDateRange();
  const { cdxApiUrl, archiveUrlBase, targetUrl } = config.wayback;

  console.log(`Fetching snapshots from ${startDate} to ${endDate}...`);

  const params = {
    url: targetUrl,
    output: 'json',
    from: startDate,
    to: endDate,
    filter: 'statuscode:200',
    collapse: 'timestamp:8', // One snapshot per day
  };

  try {
    const response = await axios.get(cdxApiUrl, { params });
    const data = response.data;

    if (!data || data.length < 2) {
      console.log('No snapshots found for the specified date range.');
      return [];
    }

    // First row is headers, rest are data
    const headers = data[0];
    const timestampIndex = headers.indexOf('timestamp');

    const snapshots = data.slice(1).map(row => {
      const timestamp = row[timestampIndex];
      const dateStr = timestamp.slice(0, 8);
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

      return {
        timestamp,
        date: formattedDate,
        archiveUrl: `${archiveUrlBase}/${timestamp}/${targetUrl}`,
      };
    });

    console.log(`Found ${snapshots.length} snapshot(s).`);
    return snapshots;

  } catch (error) {
    console.error('Error fetching snapshots from Wayback Machine:', error.message);
    throw error;
  }
}

module.exports = {
  fetchSnapshots,
  getDateRange,
  formatDate,
};

