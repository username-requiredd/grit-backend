// prisma/seed.ts

import { PrismaClient, Role, BoardVisibility } from '@prisma/client';

const prisma = new PrismaClient();

// 🚨 IMPORTANT: Replace this with the ACTUAL ID of a user from your Supabase auth.users table.
const TEST_USER_ID = '9dae8bc1-27e4-4f83-8c43-ae82329a72ad';

async function main() {
  console.log('Start seeding...');

  // 1. Create a Test User (Needed to satisfy foreign key constraints)
  // This user will be linked to the existing ID from Supabase Auth.
  const testUser = await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {}, // No updates if it already exists
    create: {
      id: TEST_USER_ID,
      email: 'test.user@kanban.com',
      name: 'Kanban Admin',
      avatarUrl: 'https://example.com/avatar.png',
    },
  });
  console.log(`Created test user with ID: ${testUser.id}`);

  // 2. Create a Test Workspace
  const testWorkspace = await prisma.workspace.upsert({
    where: { slug: 'development-team' },
    update: {},
    create: {
      title: 'Development Team',
      slug: 'development-team',
      ownerId: testUser.id,
    },
  });
  console.log(`Created workspace with ID: ${testWorkspace.id}`);

  // 3. Link the User to the Workspace (WorkspaceMember)
  // This is the record the BoardService relies on for authorization!
  const member = await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: testUser.id,
        workspaceId: testWorkspace.id,
      },
    },
    update: {},
    create: {
      userId: testUser.id,
      workspaceId: testWorkspace.id,
      role: Role.ADMIN, // Granting admin role for testing
    },
  });
  console.log(`Linked user ${member.userId} to workspace ${member.workspaceId} as ADMIN.`);

  // 4. Create an initial Board (Optional, but useful for initial GET requests)

const initialBoard = await prisma.board.upsert({
  // 💡 FIX: Use the unique field 'slug' instead of 'title' for the 'where' clause.
  where: { slug: 'template-board' }, 
  update: {},
  create: {
    title: 'Template Board',
    slug: 'template-board', // Must be present in the create block too
    workspaceId: testWorkspace.id,
    ownerId: testUser.id,
    visibility: BoardVisibility.WORKSPACE,
    columns: {
      create: [
        { title: 'Ideas', position: 1 },
        { title: 'In Review', position: 2 },
        { title: 'Completed', position: 3, isFinal: true },
      ],
    },
  },
});
console.log(`Created initial board with ID: ${initialBoard.id}`);

  console.log(`Created initial board with ID: ${initialBoard.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });