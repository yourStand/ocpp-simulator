// OCPP-J (JSON over WebSocket) のメッセージ枠組み。
// 仕様: メッセージは JSON 配列。先頭要素 (MessageTypeId) で種別を表す。

export const CALL = 2; // [2, uniqueId, action, payload]
export const CALLRESULT = 3; // [3, uniqueId, payload]
export const CALLERROR = 4; // [4, uniqueId, errorCode, errorDescription, errorDetails]

export const OCPP_SUBPROTOCOL = "ocpp1.6";

let counter = 0;

export function nextMessageId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export function encodeCall(uniqueId, action, payload) {
  return JSON.stringify([CALL, uniqueId, action, payload ?? {}]);
}

export function encodeResult(uniqueId, payload) {
  return JSON.stringify([CALLRESULT, uniqueId, payload ?? {}]);
}

export function encodeError(uniqueId, errorCode, errorDescription, errorDetails) {
  return JSON.stringify([
    CALLERROR,
    uniqueId,
    errorCode,
    errorDescription ?? "",
    errorDetails ?? {},
  ]);
}

// 受信した生フレームを正規化する。不正な形式は { type: null } を返す。
export function decodeFrame(raw) {
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    return { type: null, error: "invalid JSON" };
  }
  if (!Array.isArray(arr) || arr.length < 2) {
    return { type: null, error: "not an OCPP frame" };
  }
  const [type, uniqueId] = arr;
  switch (type) {
    case CALL:
      return { type, uniqueId, action: arr[2], payload: arr[3] ?? {} };
    case CALLRESULT:
      return { type, uniqueId, payload: arr[2] ?? {} };
    case CALLERROR:
      return {
        type,
        uniqueId,
        errorCode: arr[2],
        errorDescription: arr[3],
        errorDetails: arr[4] ?? {},
      };
    default:
      return { type: null, error: `unknown MessageTypeId ${type}` };
  }
}
