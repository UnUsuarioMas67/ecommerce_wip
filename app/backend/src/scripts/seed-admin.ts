import { seedAdminUser } from '../seed.js';

const admin = await seedAdminUser();
console.log(`[seed] admin user ready (${admin.email})`);