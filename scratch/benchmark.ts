import { upsertRawDocument, getDb } from "../src/db.js";

async function benchmark() {
  const db = await getDb();
  // Clear table for clean benchmark
  try {
    await db.exec("DELETE FROM raw_documents WHERE endpoint LIKE 'test-endpoint%'");
  } catch (e) {
    // ignore
  }

  const numDocs = 1000;
  const docs = Array.from({ length: numDocs }).map((_, i) => ({
    day: "2024-01-01",
    id: `doc-${i}`,
    data: { value: i }
  }));

  // Baseline
  const startBaseline = Date.now();
  for (const doc of docs) {
    await upsertRawDocument(doc.day, "test-endpoint", doc.id, doc);
  }
  const endBaseline = Date.now();
  console.log(`Baseline (Sequential): ${endBaseline - startBaseline}ms`);

  // Optimized (Promise.all)
  const startOptimized = Date.now();
  await Promise.all(docs.map(doc => upsertRawDocument(doc.day, "test-endpoint-2", doc.id, doc)));
  const endOptimized = Date.now();
  console.log(`Optimized (Promise.all): ${endOptimized - startOptimized}ms`);
}

benchmark().catch(console.error);
