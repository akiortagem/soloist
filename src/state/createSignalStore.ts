export type SignalStore<TState> = {
  getSnapshot: () => TState;
  subscribe: (listener: () => void) => () => void;
  setState: (patch: Partial<TState>) => void;
  update: (updater: (state: TState) => TState) => void;
};

export function createSignalStore<TState extends object>(
  initialState: TState,
): SignalStore<TState> {
  let state = initialState;
  const listeners = new Set<() => void>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot() {
      return state;
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setState(patch: Partial<TState>) {
      state = { ...state, ...patch };
      emit();
    },

    update(updater: (state: TState) => TState) {
      state = updater(state);
      emit();
    },
  };
}
