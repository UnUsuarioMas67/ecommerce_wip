import express from 'express';
import { setGlobalOptions } from 'express-zod-safe';

import { AuthError, HttpError, pgErrorCode } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { categoriesRouter } from './routes/categories.js';
import { addressesRouter } from './routes/addresses.js';
import { cartsRouter } from './routes/carts.js';
import { ordersRouter } from './routes/orders.js';
import { paymentsRouter } from './routes/payments.js';

setGlobalOptions({ missingSchemaBehavior: 'any' });

const app = express();

app.use('/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/categories', categoriesRouter);
app.use('/addresses', addressesRouter);
app.use('/carts', cartsRouter);
app.use('/orders', ordersRouter);
app.use('/payments', paymentsRouter);

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (pgErrorCode(err) === '23503') {
      res.status(409).json({ error: 'Resource is still referenced by other records' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

export default app;
