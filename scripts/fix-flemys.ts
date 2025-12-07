// Fix the database: Update Flemys channel ID
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFlemysChannel() {
  const oldId = 'UCJ0KwOV9H-BDQXANxCXKqHQ';  // Flemys2
  const newId = 'UCq773CgtdHmO7asQt1gx9Ww';  // Flemys (the correct one)

  console.log('=== Fixing Flemys Channel ID ===\n');

  // Show current state
  const channels = await prisma.youTubeChannel.findMany();
  console.log('Current channels in database:');
  for (const c of channels) {
    console.log(`  ${c.title} | ${c.channelId}`);
  }

  // Find the one to update
  const flemys = await prisma.youTubeChannel.findFirst({
    where: { channelId: oldId }
  });

  if (flemys) {
    console.log(`\nFound Flemys with old ID: ${oldId}`);
    console.log(`Updating to new ID: ${newId}`);

    await prisma.youTubeChannel.update({
      where: { id: flemys.id },
      data: { channelId: newId }
    });

    console.log('\n✅ Updated successfully!');
  } else {
    console.log(`\nNo channel found with ID ${oldId}`);
  }

  // Show after state
  const after = await prisma.youTubeChannel.findMany();
  console.log('\nChannels after update:');
  for (const c of after) {
    console.log(`  ${c.title} | ${c.channelId}`);
  }

  await prisma.$disconnect();
}

fixFlemysChannel().catch(console.error);
