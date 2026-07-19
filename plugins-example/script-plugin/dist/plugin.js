"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
let command;
async function activate(api) {
    const activations = (await api.storage.get("activations")) ?? 0;
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
function deactivate() {
    command?.dispose();
    command = undefined;
}
