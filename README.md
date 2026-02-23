
## BBC Homepage Scraper

This is a tool used for scraping the top 5 new articles displayed on the bbc homepage over time. Leverages the [web archive]() api to find snapshots and [puppeteer](https://pptr.dev/) for browser scraping.

### Installation
```bash
npm install
```

### Usage

Dates should be entered in yyyy-mm-dd format

Single Date Mode
```bash
node index dateToScrape
```

Date Range Mode

```bash
node index startDate EndDate
```
