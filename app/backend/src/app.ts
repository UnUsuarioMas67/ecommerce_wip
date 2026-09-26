import express from 'express';
import { productsRouter } from './routes/products.js';
import { categoriesRouter } from './routes/categories.js';
import { addressesRouter } from './routes/addresses.js';
import { cartsRouter } from './routes/carts.js';
import { ordersRouter } from './routes/orders.js';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/products', productsRouter);
app.use('/categories', categoriesRouter);
app.use('/addresses', addressesRouter);
app.use('/carts', cartsRouter);
app.use('/orders', ordersRouter);

export default app;