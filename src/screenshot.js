/**
 * Screenshot Capture Module
 * Uses Puppeteer to capture viewport screenshots of archived pages
 */
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import config from '../config.js';
/**
 * Sleep helper function
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let browser = null;

/**
 * Initialize Puppeteer browser instance
 * @returns {Promise<Browser>}
 */
export async function initBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: config.puppeteer.headless,
        });
    }
    return browser;
}

/**
 * Close browser instance
 */
export async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
    }
}

/**
 * Ensure screenshots directory exists
 */
export function ensureScreenshotsDir() {
    const dir = config.output.screenshotsDir;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Navigate to page with timeout handling - captures whatever has loaded
 * @param {Page} page - Puppeteer page instance
 * @param {string} url - URL to navigate to
 * @returns {Promise<{ timedOut: boolean, error: string | null }>}
 */
export async function navigateWithFallback(page, url) {
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: config.puppeteer.timeout,
        });
        return { timedOut: false, error: null };
    } catch (error) {
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            console.log('  ⚠ Navigation timeout - capturing partial page load...');
            return { timedOut: true, error: null };
        }
        console.log(`  ⚠ Navigation error: ${error.message} - attempting to continue...`);
        return { timedOut: false, error: error.message };
    }
}

/**
 * Capture screenshot of archived BBC homepage
 * @param {string} archiveUrl - Full Wayback Machine URL
 * @param {string} date - Date in yyyy-mm-dd format for filename
 * @returns {Promise<{ success: boolean, screenshotPath: string | null, error: string | null, partial: boolean }>}
 */
export async function captureScreenshot(archiveUrl, date) {
    ensureScreenshotsDir();

    const screenshotPath = path.join(config.output.screenshotsDir, `${date}.png`);

    let page = null;
    try {
        await initBrowser();
        page = await browser.newPage();

        await page.setViewport(config.puppeteer.viewport);

        console.log(`  Navigating to: ${archiveUrl}`);

        const navResult = await navigateWithFallback(page, archiveUrl);

        // Give the page some time to load additional resources
        await sleep(5000);

        // Capture screenshot of viewport (top of page) - even if partial load
        await page.screenshot({
            path: screenshotPath,
            type: 'png',
            clip: {
                x: 0,
                y: 0,
                width: config.puppeteer.viewport.width,
                height: config.puppeteer.viewport.height,
            },
        });

        await page.close();

        const partial = navResult.timedOut || navResult.error !== null;
        console.log(`  Screenshot saved: ${screenshotPath}${partial ? ' (partial load)' : ''}`);

        return {
            success: true,
            screenshotPath,
            error: navResult.error,
            partial,
        };
    } catch (error) {
        console.error(`  Screenshot error: ${error.message}`);
        if (page) {
            try {
                await page.close();
            } catch (e) {
                // Ignore close errors
            }
        }
        return {
            success: false,
            screenshotPath: null,
            error: error.message,
            partial: false,
        };
    }
}

/**
 * Get a page instance for link extraction
 * @param {string} archiveUrl
 * @returns {Promise<{ page: Page | null, error: string | null, partial: boolean }>}
 */
export async function getPage(archiveUrl) {
    try {
        await initBrowser();
        const page = await browser.newPage();

        await page.setViewport(config.puppeteer.viewport);

        const navResult = await navigateWithFallback(page, archiveUrl);

        // Give the page time to render
        await sleep(5000);

        return {
            page,
            error: navResult.error,
            partial: navResult.timedOut || navResult.error !== null,
        };
    } catch (error) {
        return { page: null, error: error.message, partial: false };
    }
}

/**
 * Capture screenshot from an already-loaded page
 * @param {Page} page - Puppeteer page instance
 * @param {string} date - Date for filename (yyyy-mm-dd)
 * @returns {Promise<{ success: boolean, screenshotPath: string | null, error: string | null }>}
 */
export async function captureScreenshotFromPage(page, date) {
    ensureScreenshotsDir();
    const screenshotPath = path.join(config.output.screenshotsDir, `${date}.png`);

    try {
        await page.screenshot({
            path: screenshotPath,
            type: 'png',
            clip: {
                x: 0,
                y: 0,
                width: config.puppeteer.viewport.width,
                height: config.puppeteer.viewport.height,
            },
        });

        console.log(`  Screenshot saved: ${screenshotPath}`);
        return { success: true, screenshotPath, error: null };
    } catch (error) {
        console.error(`  Screenshot error: ${error.message}`);
        return { success: false, screenshotPath: null, error: error.message };
    }
}
