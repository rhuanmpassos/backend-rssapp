"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const channels = await prisma.youTubeChannel.findMany();
    console.log('\n=== YouTube Channels ===\n');
    channels.forEach(c => {
        console.log(`${c.title} | ${c.channelId}`);
    });
    const wrongId = 'UCPSP19pNXtNNCnuwE7ZMFSg';
    const hasWrong = channels.some(c => c.channelId === wrongId);
    console.log(`\nWrong ID still exists: ${hasWrong ? '❌ YES' : '✅ NO'}`);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-channels.js.map