import app from './app.js';
import env from './config/env.js';
import { seedAdminUser } from './seed.js';

const PORT = env.PORT;

const admin = await seedAdminUser();
console.log(`[seed] admin user ready (${admin.email})`);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
