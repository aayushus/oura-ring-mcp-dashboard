import { getHistory } from "../dist/db.js";
function average(values) {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

async function check() {
  const data = await getHistory(60);
  console.log("Readiness length:", data.readiness.length);
  if (data.readiness.length < 10) {
    console.log("Not enough records");
    return;
  }

  const week = (rows) => ({ cur: rows.slice(-7), prev: rows.slice(-14, -7) });
  const s = week(data.sleep);
  const r = week(data.readiness);
  const a = week(data.activity);

  const entries = [
    {
      label: "Sleep score",
      cur: average(s.cur.map((x) => x.score)),
      prev: average(s.prev.map((x) => x.score)),
    },
    {
      label: "Readiness",
      cur: average(r.cur.map((x) => x.score)),
      prev: average(r.prev.map((x) => x.score)),
    },
    {
      label: "HRV",
      cur: average(r.cur.map((x) => x.hrv)),
      prev: average(r.prev.map((x) => x.hrv)),
    },
    {
      label: "Resting HR",
      cur: average(r.cur.map((x) => x.rhr)),
      prev: average(r.prev.map((x) => x.rhr)),
    },
    {
      label: "Steps",
      cur: average(a.cur.map((x) => x.steps)),
      prev: average(a.prev.map((x) => x.steps)),
    },
  ];

  console.log("weekCompare entries calculated:", JSON.stringify(entries, null, 2));
}

check().catch(console.error);
