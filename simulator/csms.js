#!/usr/bin/env node
// モックCSMSサーバーを起動する。
// 使い方: node csms.js [--port 9000] [--host 0.0.0.0]

import { MockCsms } from "./base/csms-server.js";

function parseArgs(argv) {
  const opts = { port: 9000, host: "0.0.0.0" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--port") opts.port = Number(argv[++i]);
    else if (a === "--host") opts.host = argv[++i];
    else if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log("Usage: node csms.js [--port 9000] [--host 0.0.0.0]");
  process.exit(0);
}

const csms = new MockCsms({ port: opts.port, host: opts.host });
await csms.start();

const shutdown = async () => {
  console.log("\n[CSMS] shutting down...");
  await csms.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
