"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkWrongId() {
    const wrongId = 'UCJ0KwOV9H-BDQXANxCXKqHQ';
    console.log('=== Checking for Wrong ID (Flemys2) ===\n');
    console.log('Wrong ID:', wrongId);
    const channels = await prisma.youTubeChannel.findMany({
        where: { channelId: wrongId }
    });
    const feeds = await prisma.customYouTubeFeed.findMany({
        where: { channelId: wrongId }
    });
    console.log('\nYouTubeChannel with wrong ID:', channels.length);
    channels.forEach(c => console.log('  -', c.title, '|', c.id));
    console.log('\nCustomFeed with wrong ID:', feeds.length);
    feeds.forEach(f => console.log('  -', f.title, '|', f.id));
    if (channels.length === 0 && feeds.length === 0) {
        console.log('\n✅ No entries with wrong ID found!');
    }
    else {
        console.log('\n❌ Found entries with wrong ID that need to be deleted/updated');
    }
    await prisma.$disconnect();
}
checkWrongId().catch(console.error);
//# sourceMappingURL=check-wrong-id.js.map