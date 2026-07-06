import { setState, state } from "./stateCore";
import type { AppRoute } from "./types";

export const uiActions = {
  setRoute(route: AppRoute) {
    setState({ route });
  },

  requestRightPanelOpen() {
    setState({ rightPanelOpenRequest: state.rightPanelOpenRequest + 1 });
  },

  requestRightPanelClose() {
    setState({ rightPanelCloseRequest: state.rightPanelCloseRequest + 1 });
  },

  openCharacterCreator() {
    setState({
      route: "characterSheets",
      persistenceError: undefined,
    });
  },

  setDocumentSavePending() {
    setState({
      documentSaveState: "pending",
      persistenceError: undefined,
      persistenceMessage: "Saving document...",
    });
  },
};
