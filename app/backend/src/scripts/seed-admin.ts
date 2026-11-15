import { closeDb } from '../db/index.js';
import { seedAdminUser } from '../seed.js';

try {
  const admin = await seedAdminUser();
  console.log(`[seed] admin user ready (${admin.email})`);
} finally {
  await closeDb();
}
