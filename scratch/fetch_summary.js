async function check() {
  const res = await fetch("http://localhost:3000/api/dashboard/summary");
  const data = await res.json();
  console.log("readiness count:", data.readiness.length);
  console.log("readiness last 10 entries:");
  data.readiness.slice(-10).forEach(r => {
    console.log(`day: ${r.day}, score: ${r.score}, hrv: ${r.hrv}, rhr: ${r.rhr}`);
  });
}

check().catch(console.error);
