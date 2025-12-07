import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== YouTube Channels in Database ===\n');

  const channels = await prisma.youTubeChannel.findMany({
    orderBy: { title: 'asc' },
  });

  if (channels.length === 0) {
    console.log('No YouTube channels found in database.');
    return;
  }

  console.log(`Found ${channels.length} channels:\n`);

  for (const channel of channels) {
    console.log(`📺 ${channel.title}`);
    console.log(`   ID: ${channel.id}`);
    console.log(`   Channel ID: ${channel.channelId}`);
    console.log(`   Custom URL: ${channel.customUrl || 'N/A'}`);
    console.log(`   Last Checked: ${channel.lastCheckedAt?.toISOString() || 'Never'}`);
    console.log('');
  }

  // Check for duplicate channel IDs
  const channelIdCounts = new Map<string, number>();
  channels.forEach(c => {
    const count = channelIdCounts.get(c.channelId) || 0;
    channelIdCounts.set(c.channelId, count + 1);
  });

  const duplicates = Array.from(channelIdCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('⚠️  WARNING: Duplicate channel IDs found:');
    duplicates.forEach(([id, count]) => {
      console.log(`   ${id}: ${count} occurrences`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
