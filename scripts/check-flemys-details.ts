import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFlemys() {
  const feed = await prisma.customYouTubeFeed.findFirst({
    where: { slug: 'flemys' }
  });

  console.log('=== Flemys Feed Details ===\n');
  console.log(JSON.stringify(feed, null, 2));

  await prisma.$disconnect();
}

checkFlemys().catch(console.error);
