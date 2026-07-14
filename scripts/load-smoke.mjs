const baseUrl = process.env.API_URL ?? "http://127.0.0.1:4000";
const requests = Number(process.env.LOAD_REQUESTS ?? 100);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);
const paths = ["/health/live", "/health/ready", "/api/feed?limit=20", "/api/nations/demo-nation/profile"];

let cursor = 0;
let failures = 0;
const latencies = [];

async function worker() {
  while (cursor < requests) {
    const index = cursor++;
    const started = performance.now();
    const response = await fetch(`${baseUrl}${paths[index % paths.length]}`);
    latencies.push(performance.now() - started);
    if (!response.ok) failures += 1;
    await response.arrayBuffer();
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
latencies.sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] ?? 0;
console.log(
  JSON.stringify(
    { requests, concurrency, failures, p50Ms: percentile(0.5).toFixed(1), p95Ms: percentile(0.95).toFixed(1) },
    null,
    2
  )
);
if (failures) process.exitCode = 1;
