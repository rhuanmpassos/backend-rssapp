// Find the correct pattern by looking for the handle in context

async function findCorrectPattern() {
  const handle = 'Flemys';
  const correctId = 'UCJ0KwOV9H-BDQXANxCXKqHQ';
  const url = `https://www.youtube.com/@${handle}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await response.text();

  console.log(`\n=== Finding Correct Pattern for @${handle} ===\n`);
  console.log(`Target correct ID: ${correctId}`);
  console.log(`ID exists in page: ${html.includes(correctId) ? '✅ YES' : '❌ NO'}\n`);

  // Find the context around the correct ID
  const idx = html.indexOf(correctId);
  if (idx > -1) {
    const contextStart = Math.max(0, idx - 200);
    const contextEnd = Math.min(html.length, idx + 200);
    const context = html.substring(contextStart, contextEnd);
    console.log('=== Context around correct ID ===\n');
    console.log(context);
    console.log('\n');
  }

  // Try to find patterns with the handle name
  console.log('=== Finding patterns with handle ===\n');

  // Pattern: Look for the handle followed by externalId
  const handleIdx = html.indexOf(`"@${handle}"`);
  if (handleIdx > -1) {
    const afterHandle = html.substring(handleIdx, handleIdx + 500);
    const idInContext = afterHandle.match(/(UC[a-zA-Z0-9_-]{22})/);
    console.log(`After "@${handle}": ${idInContext?.[1] || 'NOT FOUND'}`);
  }

  // Pattern: Look for title:"Flemys" context
  const titleIdx = html.indexOf(`"title":"${handle}"`);
  if (titleIdx > -1) {
    const afterTitle = html.substring(titleIdx, titleIdx + 500);
    const idInContext = afterTitle.match(/(UC[a-zA-Z0-9_-]{22})/);
    console.log(`After "title":"${handle}": ${idInContext?.[1] || 'NOT FOUND'}`);
  }

  // Pattern: Look for channelMetadataRenderer that contains the correct handle
  // The page owner's channelMetadataRenderer should have vanityChannelUrl matching the handle
  const ownerMetadata = html.match(
    /"channelMetadataRenderer":\{[^}]*"vanityChannelUrl":"https:\/\/www\.youtube\.com\/@Flemys"[^}]*"externalId":"(UC[a-zA-Z0-9_-]{22})"/i
  );
  console.log(`channelMetadataRenderer with vanityChannelUrl=@${handle}: ${ownerMetadata?.[1] || 'NOT FOUND'}`);

  // Pattern: Try looking for ownerChannelId or mainChannelId
  const ownerIdMatch = html.match(/"ownerChannelId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`ownerChannelId: ${ownerIdMatch?.[1] || 'NOT FOUND'}`);

  const mainChannelMatch = html.match(/"mainAppWebResponseContext".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`mainAppWebResponseContext channelId: ${mainChannelMatch?.[1] || 'NOT FOUND'}`);

  // Pattern: Look for c4TabbedHeaderRenderer which is the main page header
  const c4HeaderMatch = html.match(/"c4TabbedHeaderRenderer".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
  console.log(`c4TabbedHeaderRenderer channelId: ${c4HeaderMatch?.[1] || 'NOT FOUND'}`);

  // Pattern: browseEndpoint with the channel's own page
  const browseEndpointMatch = html.match(/"browseEndpoint":\{"browseId":"(UC[a-zA-Z0-9_-]{22})","canonicalBaseUrl":"\/@Flemys"/i);
  console.log(`browseEndpoint with canonicalBaseUrl @${handle}: ${browseEndpointMatch?.[1] || 'NOT FOUND'}`);

  // Pattern: Look for link rel="alternate" type="application/rss+xml"
  const rssLinkMatch = html.match(/<link rel="alternate" type="application\/rss\+xml"[^>]+channel_id=(UC[a-zA-Z0-9_-]{22})/);
  console.log(`RSS alternate link: ${rssLinkMatch?.[1] || 'NOT FOUND'}`);
}

findCorrectPattern().catch(console.error);
