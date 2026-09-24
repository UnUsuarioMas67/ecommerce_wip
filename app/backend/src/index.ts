import express from "express";
import { CreateProductSchema, treeifyError, type CreateProductInput } from "@ecommerce/schemas";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/products", (req, res) => {
  const parsed = CreateProductSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: treeifyError(parsed.error) });
    return;
  }

  const input: CreateProductInput = parsed.data;
  res.status(201).json({ product: input });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});