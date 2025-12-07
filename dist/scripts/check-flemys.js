async function checkIds() {
    const ids = [
        { id: 'UCq773CgtdHmO7asQt1gx9Ww', label: 'scraped from @Flemys page' },
        { id: 'UCJ0KwOV9H-BDQXANxCXKqHQ', label: 'in database' },
    ];
    for (const { id, label } of ids) {
        console.log(`\n=== Checking ${id} (${label}) ===`);
        try {
            const url = `https://www.youtube.com/channel/${id}`;
            const r = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            const html = await r.text();
            const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
            const handle = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/(@[^"]+)"/)?.[1]
                || html.match(/"vanityChannelUrl":"https:\/\/www\.youtube\.com\/(@[^"]+)"/)?.[1];
            console.log(`  Title: ${title || 'NOT FOUND'}`);
            console.log(`  Handle: ${handle || 'NOT FOUND'}`);
        }
        catch (e) {
            console.log(`  Error: ${e.message}`);
        }
    }
}
checkIds().catch(console.error);
//# sourceMappingURL=check-flemys.js.map