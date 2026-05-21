import { UserModel } from './models/User.js';

const DEV_USERS = [
  {
    email: 'ada@pathforge.dev',
    name: 'Ada Lovelace',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Ada%20Lovelace',
  },
  {
    email: 'alan@pathforge.dev',
    name: 'Alan Turing',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Alan%20Turing',
  },
  {
    email: 'grace@pathforge.dev',
    name: 'Grace Hopper',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Grace%20Hopper',
  },
  {
    email: 'demo@pathforge.dev',
    name: 'Pathfinder Demo',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Pathfinder%20Demo',
    isDemoUser: true,
  },
];

export async function seedDevUsersIfEmpty(): Promise<void> {
  const count = await UserModel.estimatedDocumentCount();
  if (count === 0) {
    await UserModel.insertMany(DEV_USERS);
    return;
  }
  // Backfill the demo user even when the collection already has users.
  // Without this, environments seeded before isDemoUser shipped would never
  // get a demo user without a volume wipe.
  const demoExists = await UserModel.exists({ email: 'demo@pathforge.dev' });
  if (!demoExists) {
    const demo = DEV_USERS.find((u) => u.email === 'demo@pathforge.dev')!;
    await UserModel.create(demo);
  }
}
