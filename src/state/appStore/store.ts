import { bootstrapActions } from "./bootstrapActions";
import { campaignActions } from "./campaignActions";
import { chaosActions } from "./chaosActions";
import { characterSheetActions } from "./characterSheetActions";
import { combatActions } from "./combatActions";
import { getSnapshot, subscribe } from "./stateCore";
import { pluginActions } from "../../features/plugins/presentation/pluginActions";
import { templateActions } from "./templateActions";
import { uiActions } from "./uiActions";

export type {
  AppRoute,
  AppState,
  ChaosDeltaResult,
  StatDeltaResult,
} from "./types";

export const appStore = {
  getSnapshot,
  subscribe,
  ...uiActions,
  ...bootstrapActions,
  ...templateActions,
  ...pluginActions,
  ...campaignActions,
  ...characterSheetActions,
  ...combatActions,
  ...chaosActions,
};
