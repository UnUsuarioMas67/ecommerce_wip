import express from 'express';
import { productsRouter } from './routes/products';
import { categoriesRouter } from './routes/categories';
import { addressesRouter } from './routes/addresses';
import { cartsRouter } from './routes/carts';
import { ordersRouter } from './routes/orders';
import env from './config/env';

const app = express();
const PORT = env.PORT;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/products', productsRouter);
app.use('/categories', categoriesRouter);
app.use('/addresses', addressesRouter);
app.use('/carts', cartsRouter);
app.use('/orders', ordersRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});