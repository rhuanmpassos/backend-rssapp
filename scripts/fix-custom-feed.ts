import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WRONG_ID = 'UCPSP19pNXtNNCnuwE7ZMFSg';
const CORRECT_ID = 'UChzRVlOfDxtLFvNHKSI1PLg';

async function main() {
  console.log('\n=== Fixing CustomYouTubeFeed ustressed ===\n');

  // Find the wrong feed
  const wrongFeed = await prisma.customYouTubeFeed.findFirst({
    where: { channelId: WRONG_ID },
  });

  if (!wrongFeed) {
    console.log('✅ No feed with wrong ID found. Already fixed!');
    return;
  }

  console.log(`Found: ${wrongFeed.title} (${wrongFeed.slug})`);
  console.log(`Wrong ID: ${wrongFeed.channelId}`);
  console.log(`Correcting to: ${CORRECT_ID}`);

  // Update to correct ID
  await prisma.customYouTubeFeed.update({
    where: { id: wrongFeed.id },
    data: { channelId: CORRECT_ID },
  });

  console.log('\n✅ Successfully updated to correct ID!');
}

main().finally(() => prisma.$disconnect());
