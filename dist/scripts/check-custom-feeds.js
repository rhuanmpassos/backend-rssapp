"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const feeds = await prisma.customYouTubeFeed.findMany();
    console.log('\n=== Custom YouTube Feeds ===\n');
    feeds.forEach(f => {
        console.log(`${f.title} | ${f.channelId} | ${f.slug}`);
    });
    const wrongId = 'UCPSP19pNXtNNCnuwE7ZMFSg';
    const hasWrong = feeds.some(f => f.channelId === wrongId);
    console.log(`\nWrong ID in custom feeds: ${hasWrong ? '❌ YES - DELETE IT!' : '✅ NO'}`);
    if (hasWrong) {
        const wrongFeed = feeds.find(f => f.channelId === wrongId);
        console.log(`\nWrong feed: ${wrongFeed?.title} (${wrongFeed?.id})`);
    }
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-custom-feeds.js.map