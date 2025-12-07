import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The WRONG channel ID that was scraped from a related channel
const WRONG_CHANNEL_ID = 'UCPSP19pNXtNNCnuwE7ZMFSg';

// The CORRECT uStressed channel ID
const CORRECT_CHANNEL_ID = 'UChzRVlOfDxtLFvNHKSI1PLg';

async function main() {
  console.log('=== Fixing Duplicate uStressed Channel ===\n');

  // Find the wrong record
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

  // Delete related videos first
  if (wrongChannel.videos.length > 0) {
    console.log(`\n🗑️  Deleting ${wrongChannel.videos.length} videos...`);
    await prisma.youTubeVideo.deleteMany({
      where: { channelDbId: wrongChannel.id },
    });
  }

  // Delete subscriptions pointing to wrong channel
  if (wrongChannel.subscriptions.length > 0) {
    console.log(`🗑️  Deleting ${wrongChannel.subscriptions.length} subscriptions...`);
    await prisma.subscription.deleteMany({
      where: { channelId: wrongChannel.id },
    });
  }

  // Delete the wrong channel
  console.log(`🗑️  Deleting wrong channel...`);
  await prisma.youTubeChannel.delete({
    where: { id: wrongChannel.id },
  });

  console.log('\n✅ Successfully deleted wrong channel!');

  // Verify correct channel exists
  const correctChannel = await prisma.youTubeChannel.findUnique({
    where: { channelId: CORRECT_CHANNEL_ID },
  });

  if (correctChannel) {
    console.log(`\n✅ Correct channel exists: ${correctChannel.title} (${correctChannel.channelId})`);
  } else {
    console.log('\n⚠️  Correct channel not found. You may need to re-add it.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
