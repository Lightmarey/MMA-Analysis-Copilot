const readline = require("node:readline");

let count = 0;
console.log(JSON.stringify({ id: "__worker_ready__", ok: true, title: "Mock Wolfram worker ready" }));

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", line => {
  if (!line.trim()) return;
  const request = JSON.parse(line);
  count += 1;
  console.log(JSON.stringify({
    id: request.id,
    ok: true,
    title: request.tool,
    output: `pid=${process.pid};count=${count};tool=${request.tool}`,
    elapsedMs: 1
  }));
});
