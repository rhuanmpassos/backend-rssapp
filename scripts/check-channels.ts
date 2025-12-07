import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const channels = await prisma.youTubeChannel.findMany();

  console.log('\n=== YouTube Channels ===\n');
  channels.forEach(c => {
    console.log(`${c.title} | ${c.channelId}`);
  });

  // Check for the wrong ID
  const wrongId = 'UCPSP19pNXtNNCnuwE7ZMFSg';
  const hasWrong = channels.some(c => c.channelId === wrongId);
  console.log(`\nWrong ID still exists: ${hasWrong ? '❌ YES' : '✅ NO'}`);
}

main().finally(() => prisma.$disconnect());
