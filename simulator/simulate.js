#!/usr/bin/env node
// 充電器シミュレーター。プロファイルに「明記された電文」だけを送る。
// 送信電文は vendors/<vendor>/.../messages/*.json 由来（暗黙の電文は送らない）。
//
// モード:
//   1) batch（既定）  : 定義済み電文を順に一通り送って終了
//   2) interactive    : 接続を保ち、対話的に選んだ電文をオンデマンド送信
//   3) send <Action>  : 指定電文を1つだけ送って終了（スクリプト向け）
//
// 使い方:
//   node simulate.js --profile ysc2                 # 一通り送る
//   node simulate.js --profile ysc2 --interactive   # オンデマンド
//   node simulate.js --profile ysc2 --send StatusNotification

import { readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { ChargePoint } from "./base/charge-point.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// ベンダープロファイル: 実電文(JSON)が置かれた version ディレクトリを指す。
const PROFILES = {
  ysc2: "../vendors/yourstand/models/ysc2/versions/aaaa_v1_1_1",
};

// batch / interactive メニューでの送信順。ここに無いものは後ろにファイル名順で続く。
const ORDER = ["BootNotification", "StatusNotification"];

function loadProfile(nameOrPath) {
  const rel = PROFILES[nameOrPath] ?? nameOrPath;
  const dir = isAbsolute(rel) ? rel : resolve(HERE, rel);
  const msgDir = resolve(dir, "messages");
  const messages = {};
  for (const f of readdirSync(msgDir).filter((f) => f.endsWith(".json"))) {
    messages[basename(f, ".json")] = JSON.parse(readFileSync(resolve(msgDir, f), "utf8"));
  }
  const head = ORDER.filter((a) => a in messages);
  const rest = Object.keys(messages)
    .filter((a) => !head.includes(a))
    .sort();
  return { dir, messages, actions: [...head, ...rest] };
}

function parseArgs(argv) {
  const opts = { id: "CP-001", url: "ws://localhost:9000", profile: "ysc2", mode: "batch", send: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--id") opts.id = argv[++i];
    else if (a === "--url") opts.url = argv[++i];
    else if (a === "--profile") opts.profile = argv[++i];
    else if (a === "--interactive" || a === "-i") opts.mode = "interactive";
    else if (a === "--send") {
      opts.mode = "send";
      opts.send = argv[++i];
    } else if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log(
    [
      "Usage: node simulate.js [--profile ysc2] [--id CP-001] [--url ws://localhost:9000]",
      "  (既定)            定義済み電文を順に一通り送って終了",
      "  --interactive,-i  接続を保ち、対話的にオンデマンド送信",
      "  --send <Action>   指定電文を1つだけ送って終了",
      `Profiles: ${Object.keys(PROFILES).join(", ")}`,
    ].join("\n"),
  );
  process.exit(0);
}

const profile = loadProfile(opts.profile);
console.log(`>>> profile: ${opts.profile} (${profile.dir})`);
console.log(`>>> 定義済み電文: ${profile.actions.join(", ")}`);

const cp = new ChargePoint({ chargePointId: opts.id, csmsUrl: opts.url });
await cp.connect();

const sendAction = async (action) => {
  const payload = profile.messages[action];
  if (!payload) throw new Error(`未定義の電文: ${action}`);
  const conf = await cp.call(action, payload);
  console.log(`    conf: ${JSON.stringify(conf)}`);
  return conf;
};

async function runBatch() {
  for (const action of profile.actions) {
    await sendAction(action);
  }
  await cp.disconnect();
  console.log(">>> batch 完了");
  process.exit(0);
}

async function runSend(action) {
  if (!(action in profile.messages)) {
    console.error(`未定義の電文: ${action}（定義済み: ${profile.actions.join(", ")}）`);
    await cp.disconnect();
    process.exit(1);
  }
  await sendAction(action);
  await cp.disconnect();
  process.exit(0);
}

function runInteractive() {
  const printMenu = () => {
    console.log("\n送信可能な電文:");
    profile.actions.forEach((a, i) => console.log(`  ${i + 1}) ${a}`));
    console.log("  list 一覧再表示 / quit 終了");
  };

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "ocpp> " });
  printMenu();
  rl.prompt();

  // 行を直列処理する（パイプ入力でも送信完了前に次の行/quitが割り込まないように）。
  let queue = Promise.resolve();

  rl.on("line", (line) => {
    queue = queue.then(async () => {
      const t = line.trim();
      if (!t) return rl.prompt();
      if (["quit", "q", "exit"].includes(t)) return rl.close();
      if (["list", "l"].includes(t)) {
        printMenu();
        return rl.prompt();
      }
      const num = Number(t);
      const action =
        Number.isInteger(num) && num >= 1 && num <= profile.actions.length
          ? profile.actions[num - 1]
          : profile.actions.includes(t)
            ? t
            : null;
      if (!action) {
        console.log(`不明な入力: ${t}（番号 or 電文名を入力）`);
        return rl.prompt();
      }
      try {
        await sendAction(action);
      } catch (e) {
        console.error(`error: ${e.message}`);
      }
      rl.prompt();
    });
  });

  rl.on("close", () => {
    queue.then(async () => {
      await cp.disconnect();
      console.log(">>> 終了");
      process.exit(0);
    });
  });
}

if (opts.mode === "send") await runSend(opts.send);
else if (opts.mode === "interactive") runInteractive();
else await runBatch();
