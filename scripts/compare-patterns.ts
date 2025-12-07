// Compare patterns for uStressed to find what works

async function comparePatterns() {
  const handle = 'uStressed';
  const correctId = 'UChzRVlOfDxtLFvNHKSI1PLg';
  const url = `https://www.youtube.com/@${handle}`;

  console.log(`\n=== Comparing Patterns for @${handle} ===\n`);
  console.log(`Correct ID: ${correctId}\n`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await response.text();

  // Check if correct ID exists
  console.log(`Correct ID in page: ${html.includes(correctId) ? '✅ YES' : '❌ NO'}\n`);

  // Try all possible patterns
  const patterns = [
    { name: 'mainAppWebResponseContext.channelId', regex: /"mainAppWebResponseContext".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/ },
    { name: 'webResponseContextExtensionData.channelId', regex: /"webResponseContextExtensionData".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/ },
    { name: 'responseContext.channelId', regex: /"responseContext".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/ },
    { name: 'c4TabbedHeaderRenderer.channelId', regex: /"c4TabbedHeaderRenderer".*?"channelId":"(UC[a-zA-Z0-9_-]{22})"/ },
    { name: 'metadata.channelMetadataRenderer.externalId', regex: /"metadata":\{"channelMetadataRenderer":\{[^}]*"externalId":"(UC[a-zA-Z0-9_-]{22})"/ },
    { name: 'ytInitialData metadata externalId', regex: /ytInitialData.*?"metadata".*?"externalId":"(UC[a-zA-Z0-9_-]{22})"/ },
  ];

  console.log('=== Pattern Results ===\n');
  for (const { name, regex } of patterns) {
    const match = html.match(regex);
    const foundId = match?.[1] || 'NOT FOUND';
    const isCorrect = foundId === correctId;
    console.log(`${isCorrect ? '✅' : '❌'} ${name}: ${foundId}`);
  }

  // Find context around correct ID
  console.log('\n=== Context around correct ID ===\n');
  const idx = html.indexOf(correctId);
  if (idx > -1) {
    const context = html.substring(Math.max(0, idx - 300), Math.min(html.length, idx + 100));
    console.log(context);
  }
}

comparePatterns().catch(console.error);
