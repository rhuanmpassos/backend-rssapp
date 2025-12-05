import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const testPasswordHash = await bcrypt.hash('rhuancar17', 12);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'rhuanc01@gmail.com' },
    update: {},
    create: {
      email: 'rhuanc01@gmail.com',
      name: 'Rhuan',
      passwordHash: testPasswordHash,
      preferences: {
        notificationsEnabled: true,
        language: 'pt-BR',
      },
    },
  });

  console.log(`✅ Created test user: ${testUser.email}`);

  // Create demo user (for reference)
  const demoPasswordHash = await bcrypt.hash('DemoPass123', 12);
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash: demoPasswordHash,
      preferences: {
        notificationsEnabled: true,
        language: 'pt-BR',
      },
    },
  });

  console.log(`✅ Created demo user: ${demoUser.email}`);

  // Create sample feeds
  const feeds = [
    {
      url: 'https://techcrunch.com',
      siteDomain: 'techcrunch.com',
      title: 'TechCrunch',
      rssUrl: 'https://techcrunch.com/feed/',
      status: 'active' as const,
    },
    {
      url: 'https://www.theverge.com',
      siteDomain: 'theverge.com',
      title: 'The Verge',
      rssUrl: 'https://www.theverge.com/rss/index.xml',
      status: 'active' as const,
    },
  ];

  for (const feedData of feeds) {
    const feed = await prisma.feed.upsert({
      where: { url: feedData.url },
      update: {},
      create: feedData,
    });
    console.log(`✅ Created feed: ${feed.title}`);

    // Create subscription for test user
    await prisma.subscription.upsert({
      where: {
        id: `${testUser.id}-${feed.id}`,
      },
      update: {},
      create: {
        userId: testUser.id,
        type: 'site',
        target: feed.url,
        feedId: feed.id,
      },
    });

    // Create subscription for demo user
    await prisma.subscription.upsert({
      where: {
        id: `${demoUser.id}-${feed.id}`,
      },
      update: {},
      create: {
        userId: demoUser.id,
        type: 'site',
        target: feed.url,
        feedId: feed.id,
      },
    });
  }

  // Create sample YouTube channel
  const channel = await prisma.youTubeChannel.upsert({
    where: { channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
    update: {},
    create: {
      channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      title: 'Google Developers',
      description: 'The Google Developers channel features talks from events...',
      thumbnailUrl: 'https://yt3.ggpht.com/ytc/AIdro_m2vxvDNTl1_nAVnKFLz8m9YJE9DIxSYn1e_1npHg=s88-c-k-c0x00ffffff-no-rj',
      customUrl: '@GoogleDevelopers',
      websubTopicUrl: 'https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    },
  });
  console.log(`✅ Created YouTube channel: ${channel.title}`);

  // Create subscription for test user
  await prisma.subscription.upsert({
    where: {
      id: `${testUser.id}-youtube-${channel.id}`,
    },
    update: {},
    create: {
      userId: testUser.id,
      type: 'youtube',
      target: channel.channelId,
      channelId: channel.id,
    },
  });

  // Create subscription for demo user
  await prisma.subscription.upsert({
    where: {
      id: `${demoUser.id}-youtube-${channel.id}`,
    },
    update: {},
    create: {
      userId: demoUser.id,
      type: 'youtube',
      target: channel.channelId,
      channelId: channel.id,
    },
  });

  console.log('✅ Database seeding completed!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Email: rhuanc01@gmail.com');
  console.log('  Password: rhuancar17');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email: demo@example.com');
  console.log('  Password: DemoPass123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



