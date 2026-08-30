import { performance } from 'perf_hooks';
import { upsertRawDocument } from './src/db.js';

async function benchmark() {
  const dataArray = Array.from({ length: 200 }, (_, i) => ({ id: `id-${i}`, day: '2023-01-01', timestamp: '2023-01-01T00:00:00' }));
  const endpoint = "test_endpoint";
  const userId = 1;
  const getToday = () => "2023-01-01";

  // Sequential
  const startSeq = performance.now();
  for (const doc of dataArray) {
    const day = doc.day ?? doc.start_day ?? doc.timestamp?.split("T")[0] ?? doc.start_datetime?.split("T")[0] ?? getToday();
    const docId = doc.id ?? doc.timestamp ?? doc.start_datetime ?? `gen-${Math.random()}`;
    await upsertRawDocument(day, endpoint, docId, doc, userId);
  }
  const endSeq = performance.now();

  // Parallel
  const startPar = performance.now();
  await Promise.all(
    dataArray.map(async (doc) => {
      const day = doc.day ?? doc.start_day ?? doc.timestamp?.split("T")[0] ?? doc.start_datetime?.split("T")[0] ?? getToday();
      const docId = doc.id ?? doc.timestamp ?? doc.start_datetime ?? `gen-${Math.random()}`;
      await upsertRawDocument(day, endpoint, docId, doc, userId);
    })
  );
  const endPar = performance.now();

  console.log(`Sequential: ${endSeq - startSeq}ms`);
  console.log(`Promise.all: ${endPar - startPar}ms`);
}

benchmark().catch(console.error);
