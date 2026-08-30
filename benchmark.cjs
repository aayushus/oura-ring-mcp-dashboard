const { performance } = require('perf_hooks');

async function benchmark() {
  // Let's first mock the db to see the performance of Promise.all vs loop

  const mockDelay = () => new Promise(resolve => setTimeout(resolve, 1));

  async function saveRawDocsSequential(dataArray) {
    if (!dataArray) return;
    for (const doc of dataArray) {
      await mockDelay();
    }
  }

  async function saveRawDocsPromiseAll(dataArray) {
    if (!dataArray) return;
    await Promise.all(
      dataArray.map(async (doc) => {
        await mockDelay();
      })
    );
  }

  const dataArray = Array.from({ length: 500 }, (_, i) => ({ id: i }));

  const startSeq = performance.now();
  await saveRawDocsSequential(dataArray);
  const endSeq = performance.now();

  const startPar = performance.now();
  await saveRawDocsPromiseAll(dataArray);
  const endPar = performance.now();

  console.log(`Sequential: ${endSeq - startSeq}ms`);
  console.log(`Promise.all: ${endPar - startPar}ms`);
}

benchmark();
