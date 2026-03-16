import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

prisma.$connect()
  .then(() => {
    console.log('✓ Database connected successfully');
  })
  .catch((error) => {
    console.error('✗ Failed to connect to database:', error.message);
    process.exit(1);
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

