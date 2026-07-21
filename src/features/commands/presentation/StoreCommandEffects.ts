import { appStore } from "../../../state/appStore";
import type { CommandEffects } from "../application/ports/CommandEffects";

export class StoreCommandEffects implements CommandEffects {
  snapshot() {
    const state = appStore.getSnapshot();
    return {
      hasActiveSession: Boolean(state.activeSession),
      combatState: state.combatState,
    };
  }

  applyStatDelta(input: Parameters<CommandEffects["applyStatDelta"]>[0]) {
    return appStore.applyStatDelta(input);
  }

  applyTrackerStatChange(
    input: Parameters<CommandEffects["applyTrackerStatChange"]>[0],
  ) {
    return appStore.applyTrackerStatChange(input);
  }

  applyChaosDelta(input: Parameters<CommandEffects["applyChaosDelta"]>[0]) {
    return appStore.applyChaosDelta(input);
  }

  startCombat() {
    void appStore.startCombat();
  }

  saveCombatState(input: Parameters<CommandEffects["saveCombatState"]>[0]) {
    void appStore.saveCombatState(input);
  }

  requestCombatPanel(state: "open" | "closed") {
    if (state === "open") appStore.requestRightPanelOpen();
    else appStore.requestRightPanelClose();
  }
}
