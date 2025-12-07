// Delete the flemys custom feed so it can be re-added with the correct ID
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteFlemysFeed() {
  console.log('=== Custom YouTube Feeds ===\n');

  const feeds = await prisma.customYouTubeFeed.findMany();
  for (const f of feeds) {
    console.log(`${f.title} | ${f.channelId} | ${f.slug}`);
  }

  // Find and delete flemys
  const flemys = await prisma.customYouTubeFeed.findFirst({
    where: { slug: 'flemys' }
  });

  if (flemys) {
    console.log(`\nDeleting: ${flemys.title} (${flemys.channelId})`);
    await prisma.customYouTubeFeed.delete({ where: { id: flemys.id } });
    console.log('✅ Deleted!');
  } else {
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
