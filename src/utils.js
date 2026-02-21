const cleanTitle = (title) => {
  return title
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

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

module.exports = { cleanTitle, cleanWaybackUrl };
