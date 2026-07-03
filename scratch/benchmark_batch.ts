import { upsertRawDocument, getDb } from "../src/db.js";

async function upsertRawDocumentsBatch(
  docs: { day: string, endpoint: string, docId: string, data: any }[]
): Promise<void> {
  if (docs.length === 0) return;
  const db = await getDb();

  const chunkSize = 200;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
    const values = chunk.flatMap(d => [d.day, d.endpoint, d.docId, JSON.stringify(d.data)]);

    await db.run(
      `INSERT INTO raw_documents (day, endpoint, doc_id, data)
       VALUES ${placeholders}
       ON CONFLICT(day, endpoint, doc_id) DO UPDATE SET
         data = excluded.data`,
      values
    );
  }
}

async function benchmark() {
  const db = await getDb();
  try {
    await db.exec("DELETE FROM raw_documents WHERE endpoint LIKE 'test-endpoint%'");
  } catch (e) {}

  const numDocs = 1000;
  const docs = Array.from({ length: numDocs }).map((_, i) => ({
    day: "2024-01-01",
    id: `doc-${i}`,
    data: { value: i }
  }));

  // Baseline
  let start = Date.now();
  for (const doc of docs) {
    await upsertRawDocument(doc.day, "test-endpoint", doc.id, doc);
  }
  let end = Date.now();
  console.log(`Baseline (Sequential): ${end - start}ms`);

  // Promise.all
  start = Date.now();
  await Promise.all(docs.map(doc => upsertRawDocument(doc.day, "test-endpoint-2", doc.id, doc)));
  end = Date.now();
  console.log(`Promise.all: ${end - start}ms`);

  // Batch
  start = Date.now();
  const batchDocs = docs.map(d => ({
    day: d.day,
    endpoint: "test-endpoint-3",
    docId: d.id,
    data: d.data
  }));
  await upsertRawDocumentsBatch(batchDocs);
  end = Date.now();
  console.log(`Batch: ${end - start}ms`);
}

benchmark().catch(console.error);
