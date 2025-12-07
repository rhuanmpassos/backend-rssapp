"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function deleteFlemysFeed() {
    console.log('=== Custom YouTube Feeds ===\n');
    const feeds = await prisma.customYouTubeFeed.findMany();
    for (const f of feeds) {
        console.log(`${f.title} | ${f.channelId} | ${f.slug}`);
    }
    const flemys = await prisma.customYouTubeFeed.findFirst({
        where: { slug: 'flemys' }
    });
    if (flemys) {
        console.log(`\nDeleting: ${flemys.title} (${flemys.channelId})`);
        await prisma.customYouTubeFeed.delete({ where: { id: flemys.id } });
        console.log('✅ Deleted!');
    }
    else {
        console.log('\nNo flemys feed found');
    }
    console.log('\n=== Remaining feeds ===');
    const remaining = await prisma.customYouTubeFeed.findMany();
    for (const f of remaining) {
        console.log(`${f.title} | ${f.channelId} | ${f.slug}`);
    }
    await prisma.$disconnect();
}
deleteFlemysFeed().catch(console.error);
//# sourceMappingURL=delete-flemys.js.map