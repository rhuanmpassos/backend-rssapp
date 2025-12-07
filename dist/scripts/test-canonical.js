async function testCanonical() {
    const channels = [
        { handle: 'Flemys', correctId: 'UCJ0KwOV9H-BDQXANxCXKqHQ' },
        { handle: 'uStressed', correctId: 'UChzRVlOfDxtLFvNHKSI1PLg' },
        { handle: 'PadovaniFPS', correctId: 'UC6Y5LJ6df0rmrghMLTNQXgQ' },
    ];
    console.log('\n=== Testing Canonical Link Pattern ===\n');
    for (const { handle, correctId } of channels) {
        const url = `https://www.youtube.com/@${handle}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        const html = await response.text();
        const canonicalMatch = html.match(/rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
        const foundId = canonicalMatch?.[1] || 'NOT FOUND';
        const isCorrect = foundId === correctId;
        console.log(`@${handle}: ${isCorrect ? '✅' : '❌'}`);
        console.log(`  Expected: ${correctId}`);
        console.log(`  Found:    ${foundId}`);
        console.log('');
    }
}
testCanonical().catch(console.error);
//# sourceMappingURL=test-canonical.js.map