// モックCSMS（Central System）。OCPP 1.6-J の WebSocket サーバー。
// シミュレーター(充電器)の接続先となり、代表的な CALL に最小応答を返す。
// 標準準拠の完全実装ではなく、接続・回帰テストの土台。

import { WebSocketServer } from "ws";
import {
  CALL,
  CALLRESULT,
  CALLERROR,
  OCPP_SUBPROTOCOL,
  decodeFrame,
  encodeResult,
  encodeError,
  encodeCall,
  nextMessageId,
} from "./ocpp-frame.js";

const DEFAULT_HANDLERS = {
  BootNotification: () => ({
    currentTime: new Date().toISOString(),
    interval: 60,
    status: "Accepted",
  }),
  Heartbeat: () => ({ currentTime: new Date().toISOString() }),
  StatusNotification: () => ({}),
  Authorize: () => ({ idTagInfo: { status: "Accepted" } }),
  StartTransaction: (payload, ctx) => ({
    transactionId: ctx.nextTransactionId(),
    idTagInfo: { status: "Accepted" },
  }),
  StopTransaction: () => ({ idTagInfo: { status: "Accepted" } }),
  MeterValues: () => ({}),
  DataTransfer: () => ({ status: "Accepted" }),
};

export class MockCsms {
  constructor({ port = 9000, host = "0.0.0.0", handlers = {}, logger = console } = {}) {
    this.port = port;
    this.host = host;
    this.logger = logger;
    this.handlers = { ...DEFAULT_HANDLERS, ...handlers };
    this.transactionSeq = 0;
    this.connections = new Map(); // chargePointId -> ws
    this.wss = null;
  }

  nextTransactionId() {
    this.transactionSeq += 1;
    return this.transactionSeq;
  }

  start() {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({
        port: this.port,
        host: this.host,
        handleProtocols: (protocols) =>
          protocols.has(OCPP_SUBPROTOCOL) ? OCPP_SUBPROTOCOL : false,
      });

      this.wss.on("connection", (ws, req) => this.#onConnection(ws, req));
      this.wss.on("listening", () => {
        this.logger.log(
          `[CSMS] listening ws://${this.host}:${this.port} (subprotocol ${OCPP_SUBPROTOCOL})`,
        );
        resolve(this);
      });
    });
  }

  #chargePointIdFromUrl(url) {
    // 慣例: ws://host:port/<chargePointId>
    const path = (url || "/").split("?")[0];
    const id = decodeURIComponent(path.replace(/^\/+/, ""));
    return id || "unknown";
  }

  #onConnection(ws, req) {
    const chargePointId = this.#chargePointIdFromUrl(req.url);
    this.connections.set(chargePointId, ws);
    this.logger.log(`[CSMS] + connected: ${chargePointId}`);

    ws.on("message", (data) => this.#onMessage(ws, chargePointId, data.toString()));
    ws.on("close", () => {
      this.connections.delete(chargePointId);
      this.logger.log(`[CSMS] - disconnected: ${chargePointId}`);
    });
    ws.on("error", (err) => this.logger.error(`[CSMS] ws error (${chargePointId}):`, err.message));
  }

  async #onMessage(ws, chargePointId, raw) {
    const frame = decodeFrame(raw);
    if (frame.type !== CALL) {
      // このモックは CP からの CALL のみ処理する（CALLRESULT/CALLERROR は無視）。
      return;
    }

    this.logger.log(`[CSMS] <= ${chargePointId} ${frame.action} ${JSON.stringify(frame.payload)}`);
    const handler = this.handlers[frame.action];

    if (!handler) {
      ws.send(
        encodeError(frame.uniqueId, "NotImplemented", `No handler for ${frame.action}`),
      );
      this.logger.warn(`[CSMS] => ${chargePointId} CALLERROR NotImplemented (${frame.action})`);
      return;
    }

    try {
      const result = await handler(frame.payload, this);
      ws.send(encodeResult(frame.uniqueId, result));
      this.logger.log(`[CSMS] => ${chargePointId} ${frame.action}.conf ${JSON.stringify(result)}`);
    } catch (err) {
      ws.send(encodeError(frame.uniqueId, "InternalError", err.message));
      this.logger.error(`[CSMS] => ${chargePointId} CALLERROR InternalError:`, err.message);
    }
  }

  // CSMS 起点の CALL（例: RemoteStartTransaction, Reset 等）を送る土台。
  sendCall(chargePointId, action, payload) {
    const ws = this.connections.get(chargePointId);
    if (!ws) throw new Error(`charge point not connected: ${chargePointId}`);
    const uniqueId = nextMessageId();
    ws.send(encodeCall(uniqueId, action, payload));
    return uniqueId;
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.wss) return resolve();
      for (const ws of this.connections.values()) ws.close();
      this.wss.close(() => resolve());
    });
  }
}

export { CALLRESULT, CALLERROR };
