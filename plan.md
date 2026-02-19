# BBC Historical Homepage Scraper

A Node.js web scraper that retrieves historical snapshots of the BBC UK homepage from the Wayback Machine, captures screenshots, extracts the top 5 headline links, and stores them in JSON format.

## Features

- **Wayback Machine Integration**: Uses the CDX API to fetch historical snapshots
- **Screenshot Capture**: Puppeteer captures viewport screenshots of archived pages
- **Smart Link Extraction**: Fallback selector chain to handle different BBC layouts over time
- **Checkpoint/Resume**: Long-running campaigns can be paused and resumed
- **Configurable Rate Limiting**: Respects Wayback Machine rate limits

## Installation

```bash
npm install
```

## Usage

```bash
# Start fresh or prompt to resume from checkpoint
npm start

# Auto-resume from existing checkpoint
npm run start:resume
```

## Configuration

Edit `config.js` to customize:

- `dateRange.daysBack`: Number of days to look back (default: 5, can scale to 200+)
- `rateLimitDelay`: Milliseconds between requests (default: 1500ms)
- `extraction.defaultLinks`: Number of headline links to extract (default: 5)

## Output

- **results.json**: JSON file containing extracted links and metadata
- **screenshots/**: PNG screenshots of each archived page

## Project Structure

```
bbc-scraper/
├── config.js              # Configuration settings
├── index.js               # Main entry point
├── src/
│   ├── wayback.js         # Wayback Machine API integration
│   ├── screenshot.js      # Puppeteer screenshot logic
│   ├── linkExtractor.js   # Headline parsing with fallback chain
│   ├── storage.js         # JSON results file operations
│   └── checkpoint.js      # Progress save/resume logic
├── screenshots/           # Output folder for images
├── results.json           # Link data output
└── checkpoint.json        # Resume state (auto-generated)
```

## Link Extraction Fallback Chain

The scraper tries multiple CSS selectors to handle BBC's changing layouts:

1. Modern BBC (2022+): `[data-testid="edinburgh-card"]`, `[data-testid="anchor-inner-wrapper"]`
2. Recent BBC (2020-2022): `.nw-c-top-stories__primary-item a`, `.nw-c-top-stories a`
3. Older BBC (2018-2020): `#news-top-stories-container a`, `.top-story a`
4. Legacy fallbacks: `.story a`, `.headline a`, `article a`
5. Final fallback: `section a`, `main a`

If no selector matches, the scraper records `{ success: false, reason: "no_selector_matched" }` and preserves the screenshot for manual comparison.
