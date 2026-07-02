async function check() {
  const res = await fetch("http://localhost:3000/api/dashboard/summary");
  const data = await res.json();
  console.log("workouts count:", data.workouts?.length);
  if (data.workouts && data.workouts.length > 0) {
    const latest = data.workouts[data.workouts.length - 1];
    console.log("latest workout keys and values:");
    console.log(JSON.stringify(latest, null, 2));
  }
}

check().catch(console.error);
