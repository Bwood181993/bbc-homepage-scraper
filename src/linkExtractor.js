/**
 * Link Extractor Module
 * Extracts top 5 headline links from BBC homepage with fallback chain
 */
const config = require('../config');

/**
 * Clean Wayback Machine URL to get original BBC URL
 * @param {string} url - Potentially prefixed Wayback URL
 * @returns {string} - Clean original URL
 */
function cleanWaybackUrl(url) {
  if (!url) return url;

  // Wayback URLs look like: /web/20260101120000/https://www.bbc.co.uk/news/article
  // or https://web.archive.org/web/20260101120000/https://www.bbc.co.uk/news/article
  const waybackPattern = /(?:https?:\/\/web\.archive\.org)?\/web\/\d+\/(https?:\/\/.+)/;
  const match = url.match(waybackPattern);

  if (match) {
    return match[1];
  }

  // Handle relative URLs - convert to absolute BBC URLs
  if (url.startsWith('/')) {
    // Remove any Wayback prefix from relative URLs
    const relativePattern = /\/web\/\d+\/(.+)/;
    const relMatch = url.match(relativePattern);
    if (relMatch) {
      return `https://www.bbc.co.uk${relMatch[1]}`;
    }
    return `https://www.bbc.co.uk${url}`;
  }

  return url;
}

/**
 * Filter links to only include BBC content links
 * @param {Array<{title: string, url: string}>} links
 * @returns {Array<{title: string, url: string}>}
 */
function filterBbcLinks(links) {
  return links.filter(link => {
    const url = link.url.toLowerCase();
    // Include BBC links, exclude common non-content links
    const isBbcLink = url.includes('bbc.co.uk') || url.includes('bbc.com') || url.startsWith('/');
    const isNotExcluded = !url.includes('/accessibility') &&
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
    const links = await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      const results = [];

      elements.forEach(el => {
        // Get the href
        const href = el.getAttribute('href');
        if (!href) return;

        // Get text content - try various approaches
        let title = el.textContent?.trim() ||
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

    return links;
  } catch (error) {
    return [];
  }
}

/**
 * Extract top 5 headline links from page using fallback chain
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<{ success: boolean, links: Array, selectorUsed: string | null, reason: string | null }>}
 */
async function extractHeadlineLinks(page) {
  const { selectorChain, maxLinks } = config.extraction;

  for (const selector of selectorChain) {
    console.log(`  Trying selector: ${selector}`);

    const rawLinks = await extractWithSelector(page, selector);

    if (rawLinks.length > 0) {
      // Clean URLs and filter
      const cleanedLinks = rawLinks.map(link => ({
        title: link.title,
        url: cleanWaybackUrl(link.url),
      }));

      const filteredLinks = filterBbcLinks(cleanedLinks);

      // Remove duplicates based on URL
      const uniqueLinks = [];
      const seenUrls = new Set();

      for (const link of filteredLinks) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          uniqueLinks.push(link);
        }
      }

      if (uniqueLinks.length > 0) {
        const topLinks = uniqueLinks.slice(0, maxLinks);
        console.log(`  Found ${topLinks.length} links using selector: ${selector}`);

        return {
          success: true,
          links: topLinks,
          selectorUsed: selector,
          reason: null,
        };
      }
    }
  }

  // No selector worked
  console.log('  No headline links found with any selector.');
  return {
    success: false,
    links: [],
    selectorUsed: null,
    reason: 'no_selector_matched',
  };
}

module.exports = {
  extractHeadlineLinks,
  cleanWaybackUrl,
};

