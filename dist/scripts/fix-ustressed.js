"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const WRONG_CHANNEL_ID = 'UCPSP19pNXtNNCnuwE7ZMFSg';
const CORRECT_CHANNEL_ID = 'UChzRVlOfDxtLFvNHKSI1PLg';
async function main() {
    console.log('=== Fixing Duplicate uStressed Channel ===\n');
    const wrongChannel = await prisma.youTubeChannel.findUnique({
        where: { channelId: WRONG_CHANNEL_ID },
        include: {
            videos: true,
            subscriptions: true,
        },
    });
    if (!wrongChannel) {
        console.log('✅ No wrong channel found. Already fixed!');
        return;
    }
    console.log(`❌ Found wrong channel: ${wrongChannel.title} (${wrongChannel.channelId})`);
    console.log(`   Videos: ${wrongChannel.videos.length}`);
    console.log(`   Subscriptions: ${wrongChannel.subscriptions.length}`);
    if (wrongChannel.videos.length > 0) {
        console.log(`\n🗑️  Deleting ${wrongChannel.videos.length} videos...`);
        await prisma.youTubeVideo.deleteMany({
            where: { channelDbId: wrongChannel.id },
        });
    }
    if (wrongChannel.subscriptions.length > 0) {
        console.log(`🗑️  Deleting ${wrongChannel.subscriptions.length} subscriptions...`);
        await prisma.subscription.deleteMany({
            where: { channelId: wrongChannel.id },
        });
    }
    console.log(`🗑️  Deleting wrong channel...`);
    await prisma.youTubeChannel.delete({
        where: { id: wrongChannel.id },
    });
    console.log('\n✅ Successfully deleted wrong channel!');
    const correctChannel = await prisma.youTubeChannel.findUnique({
        where: { channelId: CORRECT_CHANNEL_ID },
    });
    if (correctChannel) {
        console.log(`\n✅ Correct channel exists: ${correctChannel.title} (${correctChannel.channelId})`);
    }
    else {
        console.log('\n⚠️  Correct channel not found. You may need to re-add it.');
    }
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=fix-ustressed.js.map