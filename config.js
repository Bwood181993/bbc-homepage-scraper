/**
 * Configuration for BBC Historical Scraper
 */
module.exports = {
  // Date range settings
  // Format: YYYYMMDD
  // Default: past 5 days (for testing)
  // Can be extended to 200+ days for full campaigns
  dateRange: {
    // Calculate start date (2 days ago for testing)
    daysBack: 2,
    // Or specify explicit dates (overrides daysBack if set)
    startDate: null, // e.g., '20260101'
    endDate: null,   // e.g., '20260215'
  },

  // Rate limiting (in milliseconds)
  // Wayback Machine recommends ~1-2 seconds between requests
  rateLimitDelay: 1500,

  // Checkpoint settings
  checkpoint: {
    // Save checkpoint after every N snapshots
    saveInterval: 1,
    // Checkpoint file path
    filePath: './checkpoint.json',
  },

  // Output settings
  output: {
    resultsFile: './results.json',
    screenshotsDir: './screenshots',
  },

  // Wayback Machine settings
  wayback: {
    cdxApiUrl: 'https://web.archive.org/cdx/search/cdx',
    archiveUrlBase: 'https://web.archive.org/web',
    targetUrl: 'https://www.bbc.co.uk',
  },

  // Puppeteer settings
  puppeteer: {
    headless: 'new', // Use new headless mode
    viewport: {
      width: 1920,
      height: 1080,
    },
    timeout: 120000, // 2 minutes for very slow archive pages
  },

  // Link extraction settings
  extraction: {
    maxLinks: 5,
    // Selector chain - tries each in order until one works
    selectorChain: [
      // Primary: Links within first ul in main block (li elements)
      'main ul:first-of-type li a',
      'main ul li a',
      // Secondary: Anchor tags within h3 elements (headline links)
      'main h3 a',
      'h3 a',
      // Modern BBC (2022+)
      '[data-testid="edinburgh-card"]',
      '[data-testid="anchor-inner-wrapper"]',
      // Recent BBC (2020-2022)
      '.nw-c-top-stories__primary-item a',
      '.nw-c-top-stories a',
      // Older BBC (2018-2020)
      '#news-top-stories-container a',
      '.top-story a',
      // Legacy fallbacks
      '.story a',
      '.headline a',
      'article a',
      // Final fallback - first section with links
      'section a',
      // Absolute fallback - any main content link
      'main a',
      '#main-content a',
    ],
  },
};

