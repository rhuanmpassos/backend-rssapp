// Test the new multi-pattern channel ID extraction

async function extractChannelId(html: string, handle: string): Promise<{ id: string | null; details: string }> {
  const candidates: { id: string; source: string; priority: number }[] = [];

  // PRIORITY 1: Canonical URL
  const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
  if (canonicalMatch?.[1]) {
    candidates.push({ id: canonicalMatch[1], source: 'canonical', priority: 1 });
  }

  // PRIORITY 2: RSS feed link
  const rssMatch = html.match(/<link rel="alternate" type="application\/rss\+xml"[^>]+channel_id=(UC[a-zA-Z0-9_-]{22})/);
  if (rssMatch?.[1]) {
    candidates.push({ id: rssMatch[1], source: 'rss', priority: 2 });
  }

  // PRIORITY 3: og:url meta tag
  const ogUrlMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
  if (ogUrlMatch?.[1]) {
    candidates.push({ id: ogUrlMatch[1], source: 'og:url', priority: 3 });
  }

  // PRIORITY 4: channelMetadataRenderer.externalId
  const metadataMatch = html.match(/"channelMetadataRenderer":\{[^}]*?"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  if (metadataMatch?.[1]) {
    candidates.push({ id: metadataMatch[1], source: 'metadata', priority: 4 });
  }

  // PRIORITY 5: browseEndpoint with canonicalBaseUrl
  const handleRegex = new RegExp(
    `"browseEndpoint":\\{"browseId":"(UC[a-zA-Z0-9_-]{22})","[^}]*"canonicalBaseUrl":"\\/@${handle}"`,
    'i'
  );
  const browseMatch = html.match(handleRegex);
  if (browseMatch?.[1]) {
    candidates.push({ id: browseMatch[1], source: 'browseEndpoint', priority: 5 });
  }

  // PRIORITY 6: mainAppWebResponseContext
  const mainAppMatch = html.match(/"mainAppWebResponseContext"[^}]*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
  if (mainAppMatch?.[1]) {
    candidates.push({ id: mainAppMatch[1], source: 'mainApp', priority: 6 });
  }

  if (candidates.length === 0) {
    return { id: null, details: 'No candidates found' };
  }

  // Sort by priority
  candidates.sort((a, b) => a.priority - b.priority);

  const topId = candidates[0].id;
  const agreementCount = candidates.filter(c => c.id === topId).length;

  const details = candidates.map(c => `  ${c.source} (P${c.priority}): ${c.id}`).join('\n');

  return {
    id: topId,
    details: `Selected: ${topId} from ${candidates[0].source} (${agreementCount}/${candidates.length} agree)\n\nAll candidates:\n${details}`
  };
}

async function testChannel(handle: string, expectedId: string) {
  console.log(`\n=== Testing @${handle} ===\n`);
  console.log(`Expected ID: ${expectedId}`);

  const response = await fetch(`https://www.youtube.com/@${handle}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await response.text();
  const result = await extractChannelId(html, handle);

  console.log(`\n${result.details}\n`);

  if (result.id === expectedId) {
    console.log(`✅ CORRECT! Got: ${result.id}`);
  } else {
    console.log(`❌ WRONG! Expected: ${expectedId}, Got: ${result.id}`);
  }
}

async function main() {
  console.log('=== Testing New Multi-Pattern Extraction ===');

  // Test both channels
  await testChannel('Flemys', 'UCJ0KwOV9H-BDQXANxCXKqHQ');
  await testChannel('uStressed', 'UChzRVlOfDxtLFvNHKSI1PLg');
  await testChannel('PadovaniFPS', 'UC6Y5LJ6df0rmrghMLTNQXgQ');
  await testChannel('GoogleDevelopers', 'UC_x5XG1OV2P6uZZ5FSM9Ttw');
}

main().catch(console.error);
