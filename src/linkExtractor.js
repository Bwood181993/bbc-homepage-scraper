import config from '../config.js';
import { cleanTitle, cleanWaybackUrl } from './utils.js';

/**
 * Filter links to only include BBC article links
 * Rules vary by year
 * @param {Array<{title: string, url: string}>} links
 * @returns {Array<{title: string, url: string}>}
 */
function filterBbcLinks(links) {
    return links.filter((link) => {
        const url = link.url.toLowerCase();

        // Include BBC links, exclude common non-content links
        const isBbcLink =
            url.includes('bbc.co.uk') || url.includes('bbc.com') || url.startsWith('/');
        const isNotExcluded =
            !url.includes('/accessibility') &&
            !url.includes('/privacy') &&
            !url.includes('/terms') &&
            !url.includes('/contact') &&
            !url.includes('/help') &&
            !url.includes('signin') &&
            !url.includes('login') &&
            !url.includes('#') &&
            !url.includes('javascript:');
        return isBbcLink && isNotExcluded && link.title.trim().length > 0;
    });
}

/**
 * Extract links using a specific selector
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector to use
 * @returns {Promise<Array<{title: string, url: string}>>}
 */
async function extractWithSelector(page, selector) {
    try {
        return await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            const results = [];

            elements.forEach((el) => {
                // Get the href
                const href = el.getAttribute('href');
                if (!href) return;

                // Get text content - try various approaches
                let title =
                    el.textContent?.trim() ||
                    el.getAttribute('aria-label') ||
                    el.querySelector('h1, h2, h3, h4, span')?.textContent?.trim() ||
                    '';

                // Clean up title - remove extra whitespace
                title = title.replace(/\s+/g, ' ').trim();

                if (title && href) {
                    results.push({ title, url: href });
                }
            });

            return results;
        }, selector);
    } catch (error) {
        return [];
    }
}

/**
 * Extract top headline links from page using year-specific selector chain
 * @param {Page} page - Puppeteer page instance
 * @param {number} year - The year of the snapshot (for selector selection)
 * @returns {Promise<{ success: boolean, links: Array, selectorUsed: string | null, reason: string | null }>}
 */
export async function extractHeadlineLinks(page, year) {
    const { getSelectorsForYear, defaultLinks } = config.extraction;

    // Get selectors appropriate for this year
    const selectorChain = getSelectorsForYear(year);
    console.log(`  Using selectors for year ${year}`);

    const uniqueLinks = [];
    const selectorsUsed = [];
    const seenUrls = new Set();

    for (const selector of selectorChain) {
        console.log(`  Trying selector: ${selector}`);

        if (uniqueLinks.length >= defaultLinks) {
            break;
        }

        const rawLinks = await extractWithSelector(page, selector);

        if (rawLinks.length > 0) {
            // Clean URLs and filter
            const cleanedLinks = rawLinks.map((link) => ({
                title: cleanTitle(link.title),
                url: cleanWaybackUrl(link.url),
            }));

            const filteredLinks = filterBbcLinks(cleanedLinks);

            for (const link of filteredLinks) {
                // Remove duplicates
                if (!seenUrls.has(link.url) && uniqueLinks.length < defaultLinks) {
                    seenUrls.add(link.url);
                    uniqueLinks.push(link);
                    if (!selectorsUsed.includes(selector)) {
                        selectorsUsed.push(selector);
                    }
                }
            }
            console.log('uniqueLinks', uniqueLinks);
        }
    }

    if (uniqueLinks.length > 0) {
        return {
            success: true,
            links: uniqueLinks,
            selectorUsed: selectorsUsed,
            reason: null,
        };
    }
    // @TODO - if no links found, try previous & next year selectors

    // No selector worked
    console.log('  No headline links found with any selector.');
    return {
        success: false,
        links: [],
        selectorUsed: null,
        reason: 'no_selector_matched',
    };
}
