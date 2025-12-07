// Comprehensive debug script to find ALL channel ID patterns

async function analyzeYouTubePage() {
  const handle = 'Flemys';
  const url = `https://www.youtube.com/@${handle}`;

  console.log(`\n=== Analyzing YouTube Page for @${handle} ===\n`);

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

  // Save HTML snippet for analysis
  const fs = require('fs');

  // Find all unique channel IDs in the page
  const allChannelIds = new Set<string>();
  const channelIdMatches = html.matchAll(/(UC[a-zA-Z0-9_-]{22})/g);
  for (const match of channelIdMatches) {
    allChannelIds.add(match[1]);
  }

  console.log(`=== Found ${allChannelIds.size} unique channel IDs ===\n`);

  // Known IDs for reference
  const correctFlemysId = 'UCJ0KwOV9H-BDQXANxCXKqHQ'; // Flemys correct

  // Check each pattern
  console.log('=== Pattern Analysis ===\n');

  // Pattern 1: channelMetadataRenderer.externalId
  const metadataMatch = html.match(/"channelMetadataRenderer":\{[^}]*"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`1. channelMetadataRenderer.externalId: ${metadataMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 2: Look for externalId right after channelMetadataRenderer (more generous)
  const metadataMatch2 = html.match(/"channelMetadataRenderer".*?"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`2. channelMetadataRenderer...externalId: ${metadataMatch2?.[1] || 'NOT FOUND'}`);

  // Pattern 3: Look for the RSS link
  const rssMatch = html.match(/<link[^>]+rel="alternate"[^>]+type="application\/rss\+xml"[^>]+href="[^"]*channel_id=(UC[a-zA-Z0-9_-]{22})/);
  console.log(`3. RSS link: ${rssMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 4: vanityChannelUrl
  const vanityMatch = html.match(/"vanityChannelUrl":"https?:\/\/www\.youtube\.com\/@[^"]+","externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`4. vanityChannelUrl + externalId: ${vanityMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 5: Look for og:url meta tag
  const ogUrlMatch = html.match(/<meta property="og:url" content="[^"]*channel\/(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`5. og:url: ${ogUrlMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 6: canonical link
  const canonicalMatch = html.match(/<link rel="canonical" href="[^"]*channel\/(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`6. canonical link: ${canonicalMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 7: channelId in ytInitialData header
  const ytInitialMatch = html.match(/"header".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`7. ytInitialData header.channelId: ${ytInitialMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 8: Look for browseId specifically after vanityChannelUrl or ownerUrls
  const ownerMatch = html.match(/"ownerUrls":\["https?:\/\/www\.youtube\.com\/@[^"]+"\].*?"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`8. ownerUrls + externalId: ${ownerMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 9: itemprop="identifier"
  const itempropMatch = html.match(/itemprop="identifier"[^>]*content="(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`9. itemprop=identifier: ${itempropMatch?.[1] || 'NOT FOUND'}`);

  // Pattern 10: Look in the script with ytInitialData
  const scriptMatch = html.match(/var ytInitialData = [^;]+?"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`10. ytInitialData externalId: ${scriptMatch?.[1] || 'NOT FOUND'}`);

  // Check which ID is correct
  console.log(`\n=== Verification ===\n`);
  console.log(`Correct Flemys ID: ${correctFlemysId}`);
  console.log(`ID found in page: `, html.includes(correctFlemysId) ? '✅ YES' : '❌ NO');

  // Find what pattern would give us the first externalId that belongs to the channel owner
  // by looking at context around the handle
  const handlePattern = new RegExp(`"@${handle}"[^}]*"externalId":"(UC[a-zA-Z0-9_-]{22})"`, 'i');
  const handleMatch = html.match(handlePattern);
  console.log(`\n11. Handle context + externalId: ${handleMatch?.[1] || 'NOT FOUND'}`);

  // Look for the pattern with title
  const titleMatch = html.match(/"title":"Flemys"[^}]*"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`12. title:"Flemys" context: ${titleMatch?.[1] || 'NOT FOUND'}`);

  // Save a portion of HTML for manual analysis
  const startIdx = html.indexOf('channelMetadataRenderer');
  if (startIdx > -1) {
    const snippet = html.substring(startIdx, startIdx + 2000);
    console.log(`\n=== channelMetadataRenderer context (first 2000 chars) ===\n`);
    console.log(snippet.replace(/,/g, ',\n'));
  }
}

analyzeYouTubePage().catch(console.error);
