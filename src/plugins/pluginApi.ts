export type PluginJsonValue =
  | string
  | number
  | boolean
  | null
  | PluginJsonValue[]
  | { [key: string]: PluginJsonValue };

export type PluginDisposable = {
  dispose(): void;
};

export type PluginLocalStorage = {
  get<T extends PluginJsonValue = PluginJsonValue>(
    key: string,
  ): Promise<T | undefined>;
  set<T extends PluginJsonValue = PluginJsonValue>(
    key: string,
    value: T,
  ): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
};

export type PluginNotificationLevel = "info" | "success" | "warning" | "error";

export type PluginNotification = {
  level: PluginNotificationLevel;
  title: string;
  message?: string;
};

export type PluginStatusLevel = "idle" | "working" | "success" | "warning" | "error";

export type PluginStatus = {
  id: string;
  level: PluginStatusLevel;
  message: string;
};

export type PluginCommandContext = {
  pluginId: string;
  args: string[];
  argsText: string;
  chaosFactor: number;
  selectedText: string | null;
};

export type PluginResultBlockType =
  | "roll"
  | "oracle"
  | "scene"
  | "combat"
  | "stat"
  | "chaos"
  | "error";

export type PluginResultBlock = {
  type: PluginResultBlockType;
  commandText?: string;
  collapsed?: boolean;
  payload?: PluginJsonValue;
};

export type PluginCommandExecutionResult =
  | {
      type: "insertResultBlock";
      block: PluginResultBlock;
      display?: "inline" | "block";
    }
  | {
      type: "deleteCommand";
    };

export type PluginCommandHandler = (
  context: PluginCommandContext,
  api: SoloistPluginApi,
) => PluginCommandExecutionResult | Promise<PluginCommandExecutionResult>;

export type PluginSlashCommandRegistration = {
  id: string;
  name: string;
  label: string;
  prefix: string;
  description?: string;
  handler: PluginCommandHandler;
};

export type PluginOracleProvider = {
  id: string;
  name: string;
  description?: string;
  askYesNo(input: AskOracleInput): AskOracleResult | Promise<AskOracleResult>;
  setupScene(input: SceneSetupInput): SceneSetupResult | Promise<SceneSetupResult>;
};

export type SoloistPluginApi = {
  pluginId: string;
  storage: PluginLocalStorage;
  registerSlashCommand(command: PluginSlashCommandRegistration): PluginDisposable;
  registerOracleProvider(provider: PluginOracleProvider): PluginDisposable;
  notify(notification: PluginNotification): void;
  setStatus(status: PluginStatus): void;
  clearStatus(statusId: string): void;
};

export type SoloistPluginModule = {
  activate(api: SoloistPluginApi): void | Promise<void>;
  deactivate?(): void | Promise<void>;
};
import type {
  AskOracleInput,
  AskOracleResult,
  SceneSetupInput,
  SceneSetupResult,
} from "../oracle/oracleTypes";
