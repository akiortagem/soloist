import type { PluginDisposable, SoloistPluginApi } from "@soloist/plugin-sdk";

let command: PluginDisposable | undefined;

export async function activate(api: SoloistPluginApi): Promise<void> {
  const activations = (await api.storage.get<number>("activations")) ?? 0;
  await api.storage.set("activations", activations + 1);

  command = api.registerSlashCommand({
    id: "hello",
    name: "hello",
    label: "Say hello",
    prefix: "/hello",
    description: "Greets a name and shows the plugin activation count.",
    async handler(context) {
      const name = context.argsText.trim() || "traveler";
      return {
        type: "insertResultBlock",
        display: "block",
        block: {
          type: "oracle",
          commandText: `/hello ${name}`,
          payload: { message: `Hello, ${name}!`, activations: activations + 1 },
        },
      };
    },
  });
}

export function deactivate(): void {
  command?.dispose();
  command = undefined;
}
