// 充電器側スタブ（ChargePoint）。OCPP 1.6-J の WebSocket クライアント。
// CSMS へ接続し、CALL を送って CALLRESULT/CALLERROR を待つ最小実装。

import { WebSocket } from "ws";
import {
  CALL,
  CALLRESULT,
  CALLERROR,
  OCPP_SUBPROTOCOL,
  decodeFrame,
  encodeCall,
  encodeResult,
  nextMessageId,
} from "./ocpp-frame.js";

export class ChargePoint {
  constructor({
    chargePointId,
    csmsUrl = "ws://localhost:9000",
    callTimeoutMs = 10000,
    logger = console,
  }) {
    if (!chargePointId) throw new Error("chargePointId is required");
    this.chargePointId = chargePointId;
    this.csmsUrl = csmsUrl.replace(/\/+$/, "");
    this.callTimeoutMs = callTimeoutMs;
    this.logger = logger;
    this.ws = null;
    this.pending = new Map(); // uniqueId -> { resolve, reject, timer }
    this.heartbeatTimer = null;
    // CSMS 起点 CALL に応答するためのハンドラ（最小: 受領のみ）。
    this.serverCallHandlers = {};
  }

  connect() {
    const url = `${this.csmsUrl}/${encodeURIComponent(this.chargePointId)}`;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, [OCPP_SUBPROTOCOL]);
      this.ws.on("open", () => {
        this.logger.log(`[CP ${this.chargePointId}] connected -> ${url}`);
        resolve();
      });
      this.ws.on("message", (data) => this.#onMessage(data.toString()));
      this.ws.on("error", (err) => {
        this.logger.error(`[CP ${this.chargePointId}] ws error:`, err.message);
        reject(err);
      });
      this.ws.on("close", () => {
        this.#failAllPending(new Error("connection closed"));
        this.logger.log(`[CP ${this.chargePointId}] closed`);
      });
    });
  }

  #onMessage(raw) {
    const frame = decodeFrame(raw);

    if (frame.type === CALLRESULT || frame.type === CALLERROR) {
      const entry = this.pending.get(frame.uniqueId);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(frame.uniqueId);
      if (frame.type === CALLRESULT) entry.resolve(frame.payload);
      else entry.reject(new OcppCallError(frame));
      return;
    }

    if (frame.type === CALL) {
      // CSMS 起点 CALL。最小実装は空 CALLRESULT を返す（または登録ハンドラ）。
      const handler = this.serverCallHandlers[frame.action];
      const result = handler ? handler(frame.payload) : {};
      this.ws.send(encodeResult(frame.uniqueId, result));
      this.logger.log(`[CP ${this.chargePointId}] <= ${frame.action} (CSMS-initiated) => conf`);
    }
  }

  // CALL を送って応答を待つ。
  call(action, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("not connected"));
    }
    const uniqueId = nextMessageId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(uniqueId);
        reject(new Error(`CALL timeout: ${action}`));
      }, this.callTimeoutMs);
      this.pending.set(uniqueId, { resolve, reject, timer });
      this.ws.send(encodeCall(uniqueId, action, payload));
      this.logger.log(`[CP ${this.chargePointId}] => ${action} ${JSON.stringify(payload)}`);
    });
  }

  async bootNotification({ vendor = "YourStand", model = "reference-sim", payload } = {}) {
    // payload が渡されればそれをそのまま送る（ベンダープロファイルの実電文用）。
    const body = payload ?? { chargePointVendor: vendor, chargePointModel: model };
    const conf = await this.call("BootNotification", body);
    if (conf.status === "Accepted" && conf.interval > 0) {
      this.startHeartbeat(conf.interval * 1000);
    }
    return conf;
  }

  startHeartbeat(intervalMs) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.call("Heartbeat").catch((e) =>
        this.logger.error(`[CP ${this.chargePointId}] heartbeat failed:`, e.message),
      );
    }, intervalMs);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  #failAllPending(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
  }

  async disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      const ws = this.ws;
      await new Promise((resolve) => {
        ws.once("close", resolve);
        ws.close();
      });
    }
  }
}

export class OcppCallError extends Error {
  constructor(frame) {
    super(`${frame.errorCode}: ${frame.errorDescription}`);
    this.name = "OcppCallError";
    this.errorCode = frame.errorCode;
    this.errorDescription = frame.errorDescription;
    this.errorDetails = frame.errorDetails;
  }
}
