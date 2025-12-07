"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkFlemys() {
    const feed = await prisma.customYouTubeFeed.findFirst({
        where: { slug: 'flemys' }
    });
    console.log('=== Flemys Feed Details ===\n');
    console.log(JSON.stringify(feed, null, 2));
    await prisma.$disconnect();
}
checkFlemys().catch(console.error);
//# sourceMappingURL=check-flemys-details.js.map