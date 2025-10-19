import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const email = 'noahkeaneowen@hotmail.com';
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        passwordHash: true,
      },
    });

    if (user) {
      console.log('✅ User found:');
      console.log('   Email:', user.email);
      console.log('   Username:', user.username);
      console.log('   Is Admin:', user.isAdmin);
      console.log('   Has Password Hash:', !!user.passwordHash);
      console.log('   Password Hash Length:', user.passwordHash?.length || 0);
    } else {
      console.log('❌ User not found:', email);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
