/**
 * Configuration for BBC Historical Scraper
 */

// Year-specific selector chains for different BBC layouts
const yearConfigs = {
    2025: ['main ul:first-of-type li div[spacing="2"] a', 'main ul li a'],
    2024: ['main ul:first-of-type li div[spacing="2"] a', 'main ul li a'],
    2023: ['main ul:first-of-type li div[spacing="2"] a', 'main ul li a'],
    2022: ['main ul:first-of-type li div[spacing="2"] a', 'main ul li a'],
    2021: ['main ul:first-of-type li div[spacing="2"] a', 'main ul li a'],
    2020: [
        'section.uk-hero-promos-container div a.top-story',
        'section.top-stories-container a.top-story',
    ],
    2019: [
        'section.uk-hero-promos-container div a.top-story',
        'section.top-stories-container a.top-story',
    ],
    2018: [
        'section.uk-hero-promos-container div a.top-story',
        'section.top-stories-container a.top-story',
    ],
    2017: ['section.module--promo ul li h3 a'],
    2016: ['section.module--promo ul li h3 a'],
    2015: ['div.promo a.hero_image_link', 'div.promo div.container div a'],
    2014: ['div#promo2 dt a', 'div#promo dt a'],
    2013: ['div#promo2 dt a', 'div#promo dt a'],
    2012: ['div#promo2 dt a', 'div#promo dt a'],
    2011: [
        'div#promo h3 a',
        'div#news div#news_hero a.heroLink',
        'div#news div#news_moreTopStories li a',
    ],
    2010: [
        'div#blq-content div#hpFeatureBoxInt h3 a',
        'div#hpColOne div.carousel ol li p a',
        'div#hpColOne ul li p a',
    ],
    2009: [
        'div#blq-content div#hpFeatureBoxInt h3 a',
        'div#hpColOne div.carousel ol li p a',
        'div#hpColOne ul li p a',
    ],

    // Fallback for any year not specifically handled
    default: [
        'div[type="article"] a',
        'article a',
        'main a',
        'h3 a',
        'h2 a',
        '.story a',
        '.headline a',
        'section a',
    ],
};

/**
 * Get selectors for a specific year
 * @param {number} year - The year to get selectors for
 * @returns {Array<string>} - Array of CSS selectors
 */
function getSelectorsForYear(year) {
    if (yearConfigs[year]) {
        return yearConfigs[year];
    }
    return yearConfigs['default'];
}

const config = {
    // Rate limiting (in milliseconds)
    // Wayback Machine recommends ~1-2 seconds between requests
    rateLimitDelay: 1500,

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
        timeout: 90000, // 1.5 minutes for very slow archive pages
        extractionDelay: 0, // Delay before extracting links (ms) - allows page to fully render
    },

    // Link extraction settings
    extraction: {
        defaultLinks: 5,
        // Function to get selectors based on year
        getSelectorsForYear,
        // All selectors by year (for reference)
        yearConfigs,
    },
};

export default config;