// Debug script to test channel scraping

async function testScraping() {
  const handle = 'uStressed';
  const url = `https://www.youtube.com/@${handle}`;

  console.log(`\n=== Testing Channel Scraping for @${handle} ===\n`);
  console.log(`Fetching: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    console.log(`❌ Failed to fetch: ${response.status}`);
    return;
  }

  const html = await response.text();
  console.log(`✅ Fetched HTML (${html.length} bytes)\n`);

  // Test new patterns
  console.log('=== NEW Pattern Matching Results ===\n');

  // BEST: channelMetadataRenderer
  const metadataMatch = html.match(/"channelMetadataRenderer":\{[^}]*"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`1. channelMetadataRenderer.externalId: ${metadataMatch ? metadataMatch[1] : 'NOT FOUND'}`);

  // SECOND: c4TabbedHeaderRenderer
  const headerMatch = html.match(/"c4TabbedHeaderRenderer":\{[^}]*"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`2. c4TabbedHeaderRenderer.channelId: ${headerMatch ? headerMatch[1] : 'NOT FOUND'}`);

  // THIRD: RSS link
  const rssMatch = html.match(/<link[^>]+rel="alternate"[^>]+type="application\/rss\+xml"[^>]+href="[^"]*channel_id=(UC[a-zA-Z0-9_-]{22})/);
  console.log(`3. RSS link: ${rssMatch ? rssMatch[1] : 'NOT FOUND'}`);

  // Verification
  const correctId = 'UChzRVlOfDxtLFvNHKSI1PLg';

  console.log(`\n=== Verification ===\n`);
  console.log(`CORRECT ID (UChzRVlOfDxtLFvNHKSI1PLg): ${metadataMatch?.[1] === correctId ? '✅ MATCH' : '❌ NO MATCH'}`);
  console.log(`Scraping would return: ${metadataMatch?.[1] || headerMatch?.[1] || rssMatch?.[1] || 'NONE'}`);
}

testScraping().catch(console.error);
