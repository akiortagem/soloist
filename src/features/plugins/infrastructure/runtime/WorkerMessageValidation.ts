import type {
  AskOracleResult,
  SceneSetupResult,
} from "../../../../oracle/oracleTypes";
import {
  assertJsonSafe,
  requireMessageString,
  requireRecord,
} from "../../../../plugins/pluginValidation";

export type WorkerSlashCommand = {
  id: string;
  name: string;
  label: string;
  prefix: string;
  description?: string;
};

export type WorkerMessage =
  | { type: "activated"; requestId: string }
  | {
      type: "activationError" | "commandError" | "runtimeError";
      requestId?: string;
      message: string;
    }
  | { type: "commandResult"; requestId: string; result: unknown }
  | { type: "deactivated"; requestId: string; error?: string }
  | { type: "registerSlashCommand"; command: WorkerSlashCommand }
  | {
      type: "registerOracleProvider";
      provider: { id: string; name: string; description?: string };
    }
  | { type: "unregisterOracleProvider"; providerId: string }
  | { type: "oracleResult"; requestId: string; result: unknown }
  | { type: "oracleError"; requestId: string; message: string }
  | { type: "notify" | "setStatus" | "clearStatus"; payload: unknown }
  | {
      type: "hostRequest";
      requestId: string;
      action: string;
      payload: Record<string, unknown>;
    };

export function validateWorkerMessage(value: unknown): WorkerMessage {
  const message = requireRecord(value, "Worker message");
  const type = requireMessageString(message.type, "Worker message type", 64);
  const requestId = () =>
    requireMessageString(message.requestId, "Worker requestId", 256);
  const error = () =>
    requireMessageString(message.message, "Worker error message");
  switch (type) {
    case "activated":
      return envelope(message, ["type", "requestId"], {
        type,
        requestId: requestId(),
      });
    case "activationError":
    case "commandError":
    case "runtimeError":
      return envelope(message, ["type", "requestId", "message"], {
        type,
        ...(message.requestId === undefined ? {} : { requestId: requestId() }),
        message: error(),
      });
    case "commandResult":
      return envelope(message, ["type", "requestId", "result"], {
        type,
        requestId: requestId(),
        result: message.result,
      });
    case "deactivated":
      return envelope(message, ["type", "requestId", "error"], {
        type,
        requestId: requestId(),
        ...(message.error === undefined ? {} : { error: error() }),
      });
    case "registerSlashCommand":
      return envelope(message, ["type", "command"], {
        type,
        command: message.command as WorkerSlashCommand,
      });
    case "registerOracleProvider":
      return {
        type,
        provider: validateProvider(
          envelopeValue(message, ["type", "provider"], "provider"),
        ),
      };
    case "unregisterOracleProvider":
      return envelope(message, ["type", "providerId"], {
        type,
        providerId: requireMessageString(
          message.providerId,
          "Oracle provider id",
          128,
        ),
      });
    case "oracleResult":
      envelopeKeys(message, ["type", "requestId", "result"]);
      assertJsonSafe(message.result, "Oracle provider result");
      return { type, requestId: requestId(), result: message.result };
    case "oracleError":
      return envelope(message, ["type", "requestId", "message"], {
        type,
        requestId: requestId(),
        message: error(),
      });
    case "notify":
    case "setStatus":
    case "clearStatus":
      envelopeKeys(message, ["type", "payload"]);
      assertJsonSafe(message.payload, `Worker ${type} payload`);
      return { type, payload: message.payload };
    case "hostRequest":
      return validateHostRequest(message, requestId());
    default:
      throw new Error(`Unknown worker message type: ${type}`);
  }
}

export function validateOracleResult(
  method: "askYesNo" | "setupScene",
  value: unknown,
): AskOracleResult | SceneSetupResult {
  const result = requireRecord(value, "Oracle provider result");
  if (method === "askYesNo") {
    envelopeKeys(result, [
      "question",
      "odds",
      "roll",
      "answer",
      "exceptional",
      "chaosFactor",
      "providerId",
      "providerName",
      "explanation",
    ]);
    const odds = [
      "impossible",
      "no_way",
      "very_unlikely",
      "unlikely",
      "50_50",
      "likely",
      "very_likely",
      "near_sure",
      "sure_thing",
    ];
    if (!odds.includes(result.odds as string))
      throw new Error("Invalid oracle odds");
    if (result.answer !== "Yes" && result.answer !== "No")
      throw new Error("Invalid oracle answer");
    if (typeof result.exceptional !== "boolean")
      throw new Error("Oracle exceptional must be a boolean");
    return {
      question: requireMessageString(result.question, "Oracle question"),
      odds: result.odds as AskOracleResult["odds"],
      roll: number(result.roll, "Oracle roll"),
      answer: result.answer,
      exceptional: result.exceptional,
      chaosFactor: number(result.chaosFactor, "Oracle chaos factor"),
      providerId: requireMessageString(
        result.providerId,
        "Oracle result provider id",
        128,
      ),
      providerName: requireMessageString(
        result.providerName,
        "Oracle result provider name",
        128,
      ),
      explanation: requireMessageString(
        result.explanation,
        "Oracle explanation",
      ),
    };
  }
  envelopeKeys(result, [
    "prompt",
    "roll",
    "chaosFactor",
    "adjustmentType",
    "providerId",
    "providerName",
    "explanation",
  ]);
  return {
    prompt: requireMessageString(result.prompt, "Scene prompt"),
    roll: number(result.roll, "Scene roll"),
    chaosFactor: number(result.chaosFactor, "Scene chaos factor"),
    adjustmentType: requireMessageString(
      result.adjustmentType,
      "Scene adjustment type",
      128,
    ),
    providerId: requireMessageString(
      result.providerId,
      "Scene result provider id",
      128,
    ),
    providerName: requireMessageString(
      result.providerName,
      "Scene result provider name",
      128,
    ),
    explanation: requireMessageString(result.explanation, "Oracle explanation"),
  };
}

function validateProvider(value: unknown) {
  const item = requireRecord(value, "Oracle provider registration");
  envelopeKeys(item, ["id", "name", "description"]);
  return {
    id: requireMessageString(item.id, "Oracle provider id", 128),
    name: requireMessageString(item.name, "Oracle provider name", 128),
    ...(item.description === undefined
      ? {}
      : {
          description: requireMessageString(
            item.description,
            "Oracle provider description",
          ),
        }),
  };
}
function validateHostRequest(
  message: Record<string, unknown>,
  requestId: string,
): WorkerMessage {
  envelopeKeys(message, ["type", "requestId", "action", "payload"]);
  const action = requireMessageString(
    message.action,
    "Host request action",
    64,
  );
  if (
    ![
      "storage.get",
      "storage.set",
      "storage.remove",
      "storage.keys",
      "storage.clear",
    ].includes(action)
  )
    throw new Error(`Unknown host request action: ${action}`);
  const payload = requireRecord(message.payload, "Host request payload");
  assertJsonSafe(payload, "Host request payload");
  return { type: "hostRequest", requestId, action, payload };
}
function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number`);
  return value;
}
function envelope<T>(
  source: Record<string, unknown>,
  keys: readonly string[],
  result: T,
): T {
  envelopeKeys(source, keys);
  return result;
}
function envelopeValue(
  source: Record<string, unknown>,
  keys: readonly string[],
  key: string,
): unknown {
  envelopeKeys(source, keys);
  return source[key];
}
function envelopeKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown worker message field: ${unknown}`);
}
