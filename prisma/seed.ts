import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script for populating the database with initial data
 * 
 * This script creates:
 * 1. Three executive roles: CEO, CTO, COO
 * 2. Three workspaces (one for each role)
 * 3. Sample projects and tasks for demonstration
 */
async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (optional - remove in production)
  await prisma.task.deleteMany({});
  await prisma.milestone.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.role.deleteMany({});
  console.log('✓ Cleaned existing data');

  // Create roles
  const ceoRole = await prisma.role.create({
    data: {
      name: 'CEO',
      description: 'Chief Executive Officer - Full organizational visibility',
    },
  });

  const ctoRole = await prisma.role.create({
    data: {
      name: 'CTO',
      description: 'Chief Technology Officer - Technical initiatives focus',
    },
  });

  const cooRole = await prisma.role.create({
    data: {
      name: 'COO',
      description: 'Chief Operating Officer - Operations and processes focus',
    },
  });

  console.log('✓ Created roles: CEO, CTO, COO');

  // Create workspaces for each role
  const ceoWorkspace = await prisma.workspace.create({
    data: {
      name: 'CEO Dashboard',
      description: 'Strategic overview of all organizational initiatives',
      roleId: ceoRole.id,
    },
  });

  const ctoWorkspace = await prisma.workspace.create({
    data: {
      name: 'CTO Tech Stack',
      description: 'Technology infrastructure and development initiatives',
      roleId: ctoRole.id,
    },
  });

  const cooWorkspace = await prisma.workspace.create({
    data: {
      name: 'COO Operations',
      description: 'Operational processes and efficiency improvements',
      roleId: cooRole.id,
    },
  });

  console.log('✓ Created workspaces for each role');

  // Create sample projects for CTO workspace
  const platformProject = await prisma.project.create({
    data: {
      name: 'Platform Modernization',
      description: 'Upgrade core platform infrastructure',
      status: 'active',
      workspaceId: ctoWorkspace.id,
    },
  });

  const aiProject = await prisma.project.create({
    data: {
      name: 'AI Integration (Voice Tasks)',
      description: 'Implement AI-powered voice task creation feature',
      status: 'active',
      workspaceId: ctoWorkspace.id,
    },
  });

  console.log('✓ Created sample projects');

  // Create sample tasks
  await prisma.task.create({
    data: {
      title: 'Setup Express server',
      description: 'Create Express.js server with middleware',
      status: 'done',
      priority: 'high',
      projectId: platformProject.id,
      workspaceId: ctoWorkspace.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Configure PostgreSQL database',
      description: 'Setup PostgreSQL and Prisma ORM',
      status: 'in-progress',
      priority: 'high',
      projectId: platformProject.id,
      workspaceId: ctoWorkspace.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Integrate Google Speech-to-Text API',
      description: 'Setup voice transcription capability',
      status: 'todo',
      priority: 'high',
      projectId: aiProject.id,
      workspaceId: ctoWorkspace.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Connect OpenAI GPT-4 for task generation',
      description: 'Use GPT-4 to convert transcripts to task items',
      status: 'todo',
      priority: 'high',
      projectId: aiProject.id,
      workspaceId: ctoWorkspace.id,
    },
  });

  console.log('✓ Created sample tasks');

  // Create sample milestones
  await prisma.milestone.create({
    data: {
      name: 'Platform v1.0 Release',
      description: 'Initial release of modernized platform',
      dueDate: new Date('2026-06-30'),
      projectId: platformProject.id,
    },
  });

  await prisma.milestone.create({
    data: {
      name: 'Voice Feature MVP',
      description: 'Minimum viable product for voice task creation',
      dueDate: new Date('2026-05-31'),
      projectId: aiProject.id,
    },
  });

  console.log('✓ Created sample milestones');

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
