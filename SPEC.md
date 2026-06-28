# Solo TRPG Markdown App — Codex Handoff Specification

## Product Summary

Build a desktop-only, portable solo TRPG writing app.

The app is a local-first markdown writing environment with slash commands for solo tabletop roleplaying. It is similar in spirit to Obsidian or Affine, but focused specifically on solo TRPG journaling, oracle checks, dice rolls, scenes, combat tracking, and system-agnostic character sheets.

The app should support a workflow where the user writes prose, invokes slash commands inline, receives structured result blocks, and continues writing.

## Chosen Technical Direction

Use the following stack:

- Desktop shell: Tauri
- Target distribution: portable Windows `.exe` or portable app folder that does not require installation
- Frontend: React + TypeScript + Vite
- Editor: Tiptap
- Domain logic: TypeScript
- Persistence: SQLite
- Storage model: one session = one document
- Document format: Markdown + custom structured tokens
- App organization: internal document/session list, not filesystem vault
- Oracle: extensible provider system, demo oracle included by default
- Export: not required for MVP

Important architecture rule:

The domain logic must stay maintainable in TypeScript. Tauri/Rust should mainly provide desktop shell, file system access, SQLite access, and native integration. Dice rolling, oracle logic, command parsing, scene logic, stat modification, and combat logic should live in TypeScript.

## MVP Scope

The MVP must support:

1. Portable desktop app.
2. Internal list of solo TRPG sessions.
3. One document per session.
4. Tiptap editor with markdown persistence.
5. Slash command menu triggered by `/`.
6. Slash commands executable by pressing Enter.
7. Result blocks inserted into the editor.
8. Result blocks are block-level, not inline.
9. Oracle and scene result blocks can collapse/expand.
10. Dice roll result blocks can show roll breakdown.
11. Freeform system-agnostic character sheets.
12. Multiple character sheets per session.
13. Character sheet templates created from existing sheets.
14. Manual combat tracker.
15. SQLite persistence.
16. Demo oracle provider.
17. Extensible oracle provider architecture.
18. Chaos Factor defaulting to 5.
19. Slash command to modify Chaos Factor.
20. Slash command to modify character sheet stats.

## Non-Goals

Do not implement:

- Cloud sync
- Collaboration
- Plugin marketplace
- Mobile support
- Web deployment
- AI writing assistant
- Export/import
- Filesystem vault
- Specific RPG system automation
- Hardcoded proprietary Mythic GME 2e tables
- Full Mythic GME 2e reproduction
- Multiplayer combat
- Character sheet templates for official games
- Rich media embeds

## Main User Flow

A user starts a solo TRPG session.

They create a session called “Session 1”. The app creates one document for that session.

They type:

```md
/scene "I visit the adventurer's guild"
```

The app inserts a collapsible scene setup block containing the scene prompt, scene setup roll, Chaos Factor, and interpretation.

The user writes prose underneath the block.

Later, they type:

```md
/ask likely Is the guildmaster hiding something?
```

The app rolls d100 in the background and inserts a collapsible oracle block with the question, odds, Chaos Factor, d100 result, answer, exceptional status, and explanation.

Later, they type:

```md
/roll 1d20+3
```

The app inserts a roll result block. The block shows the formula and total. Expanding the block shows the individual dice results.

During combat, the user types:

```md
/combat
```

The app opens the combat panel and inserts a combat-started block.

When a character is hurt, the user types:

```md
/stat Kael HP -4
```

The app reduces Kael’s HP by 4 and inserts a stat-change result block.

## Layout

Use a three-column desktop layout.

```text
+---------------------------------------------------------------+
| Top Bar: App name, active session, save status                 |
+----------------------+----------------------+-----------------+
| Left Sidebar         | Main Editor          | Right Panel     |
|                      |                      |                 |
| Sessions/Documents   | Tiptap editor        | Character sheets|
| Character templates  | Slash commands       | Combat tracker  |
| Settings             | Result blocks        | Oracle settings |
+----------------------+----------------------+-----------------+
```

For MVP:

- Left sidebar can be simple.
- Main editor is the core.
- Right panel should show character sheets, combat, and oracle settings.
- User should be able to keep writing after command execution.

## Data Model

### Session

One session has exactly one document.

```ts
type Session = {
  id: string
  name: string
  documentId: string
  chaosFactor: number
  activeCharacterSheetId?: string
  createdAt: string
  updatedAt: string
}
```

Default `chaosFactor`: `5`.

### Document

```ts
type Document = {
  id: string
  sessionId: string
  title: string
  contentMarkdown: string
  createdAt: string
  updatedAt: string
}
```

### Character Sheet

A session can have multiple character sheets.

```ts
type CharacterSheet = {
  id: string
  sessionId: string
  name: string
  fields: CharacterField[]
  createdAt: string
  updatedAt: string
}
```

### Character Field

```ts
type CharacterField = {
  id: string
  name: string
  type: "number" | "text" | "boolean" | "longText"
  value: string | number | boolean
  maxValue?: number
  minValue?: number
  group?: string
}
```

Example:

```json
{
  "id": "sheet_kael",
  "sessionId": "session_1",
  "name": "Kael",
  "fields": [
    {
      "id": "hp",
      "name": "HP",
      "type": "number",
      "value": 16,
      "maxValue": 20,
      "minValue": 0,
      "group": "Vitals"
    },
    {
      "id": "str",
      "name": "STR",
      "type": "number",
      "value": 14,
      "group": "Stats"
    }
  ]
}
```

### Character Sheet Template

Templates are user-created from existing character sheets.

```ts
type CharacterSheetTemplate = {
  id: string
  name: string
  fields: CharacterTemplateField[]
  createdAt: string
  updatedAt: string
}

type CharacterTemplateField = {
  id: string
  name: string
  type: "number" | "text" | "boolean" | "longText"
  defaultValue: string | number | boolean
  maxValue?: number
  minValue?: number
  group?: string
}
```

Template behavior:

- User can create a template from an existing character sheet.
- Template copies field names, types, groups, min values, max values, and current values as defaults.
- User can create a new character sheet from a template.
- No built-in system templates are required.

### Combat State

```ts
type CombatState = {
  id: string
  sessionId: string
  active: boolean
  combatants: Combatant[]
  currentTurnIndex: number
  createdAt: string
  updatedAt: string
}

type Combatant = {
  id: string
  name: string
  initiative: number
  characterSheetId?: string
  notes?: string
}
```

Combat is manual and system-agnostic.

### Result Block

All command outputs are block-level editor nodes.

```ts
type ResultBlock = {
  id: string
  type:
    | "roll"
    | "oracle"
    | "scene"
    | "combat"
    | "stat"
    | "chaos"
    | "error"
  createdAt: string
  commandText: string
  collapsed?: boolean
  payload: unknown
}
```

If the user backspaces/deletes a result block, the block is destroyed. No special recovery is required beyond normal undo behavior.

## SQLite Schema

Use SQLite for persistence.

Suggested schema:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document_id TEXT NOT NULL,
  chaos_factor INTEGER NOT NULL DEFAULT 5,
  active_character_sheet_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE character_sheets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE character_sheet_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE combat_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  active INTEGER NOT NULL,
  combatants_json TEXT NOT NULL,
  current_turn_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
```

## Markdown + Custom Tokens

Persist the document as markdown with custom structured tokens for result blocks.

The editor may render them as rich Tiptap nodes, but the saved content should remain text-based.

Example roll token:

```md
{{trpg-roll id="roll_abc123" formula="1d20+3" total="17" breakdown="1d20:14,+3"}}
```

Example oracle token:

```md
{{trpg-oracle id="oracle_abc123" collapsed="false" question="Is the guildmaster hiding something?" odds="likely" chaos="5" roll="42" answer="Yes" exceptional="false" provider="demo"}}
```

Example scene token:

```md
{{trpg-scene id="scene_abc123" collapsed="false" prompt="I visit the adventurer's guild" chaos="5" roll="7" result="Normal Scene" provider="demo"}}
```

Example stat token:

```md
{{trpg-stat id="stat_abc123" sheet="Kael" stat="HP" before="20" after="16" delta="-4"}}
```

Example chaos token:

```md
{{trpg-chaos id="chaos_abc123" before="5" after="6" delta="+1"}}
```

Implementation note:

If full custom markdown parsing is difficult in the first implementation, it is acceptable to serialize result blocks as fenced custom blocks:

```md
:::trpg-roll
{"id":"roll_abc123","formula":"1d20+3","total":17,"breakdown":[{"notation":"1d20","rolls":[14]},{"notation":"+3","modifier":3}]}
:::
```

Prefer whichever representation is easier to round-trip reliably with Tiptap.

## Slash Commands

Slash commands are triggered by typing `/`.

The slash menu should help discover commands, but execution requires pressing Enter.

Supported commands:

```text
/roll [dice notation]
/ask [odds?] [yes/no question]
/scene [initial prompt]
/combat
/stat [character sheet name] [stat name] [+/- value]
/chaos [+/- value]
```

### Command Parsing

Create command parsing independent of the editor.

```ts
type ParsedCommand =
  | { type: "roll"; formula: string }
  | { type: "ask"; odds: OracleOdds; question: string }
  | { type: "scene"; prompt: string }
  | { type: "combat" }
  | { type: "stat"; sheetName: string; statName: string; delta: number }
  | { type: "chaos"; delta: number }
  | { type: "unknown"; raw: string }
```

The parser should support quoted names when needed.

Examples:

```md
/stat Kael HP -4
/stat "Kael Voss" HP -4
/stat "Bandit A" HP -2
```

## Dice Command

### Syntax

```md
/roll 1d20+3
```

Supported dice notation:

```text
1d20
d20
2d6+3
2d6-1
1d20+1d4+2
```

Requirements:

- Accept whitespace.
- Treat `d20` as `1d20`.
- Support addition and subtraction.
- Max dice count per term: 100.
- Max sides: 10000.
- Max formula length: 100 characters.
- Use simple random.
- Store individual dice values.
- Insert a block-level roll result.

### Result Block

Collapsed state not required for roll blocks, but the block should show details clearly.

Rendered example:

```text
🎲 Roll
Formula: 1d20+3
Total: 17

Details:
1d20: 14
Modifier: +3
```

## Ask Oracle Command

### Syntax

```md
/ask Is the door locked?
/ask likely Is the guard asleep?
/ask unlikely Is the merchant lying?
/ask very_likely Is the town nearby?
```

Default odds: `50/50`.

Supported odds for MVP:

```ts
type OracleOdds =
  | "impossible"
  | "no_way"
  | "very_unlikely"
  | "unlikely"
  | "50_50"
  | "likely"
  | "very_likely"
  | "near_sure"
  | "sure_thing"
```

Aliases:

```text
50/50 -> 50_50
fifty_fifty -> 50_50
very likely -> very_likely
very unlikely -> very_unlikely
near sure -> near_sure
sure thing -> sure_thing
```

### Behavior

The command rolls d100 in the background and resolves it through the active oracle provider.

Rendered collapsed example:

```text
❓ Oracle: Is the guildmaster hiding something?
Answer: Yes
```

Rendered expanded example:

```text
❓ Oracle Question
Question: Is the guildmaster hiding something?
Odds: Likely
Chaos Factor: 5
d100: 42
Answer: Yes
Exceptional: No
Provider: Demo Oracle
Explanation: Demo oracle result. Not Mythic GME 2e.
```

### Important Rule

Do not hardcode proprietary Mythic GME 2e tables.

Use the demo oracle by default and provide an extensible provider architecture so the user can later add legally usable oracle table data.

## Scene Command

### Syntax

```md
/scene
```

### Scope

Use medium scene handling for MVP.

The app should:

1. Insert a scene box.
2. WYSIWYG expected scene, with enter to submit.
3. Roll scene setup/check.
4. Use active oracle provider to interpret the result.
5. Show Chaos Factor.
6. Insert a collapsible scene result block.
7. Let the user continue writing immediately after the block.

Rendered collapsed example:

```text
🎬 Scene: I visit the adventurer's guild
Result: Normal Scene
```

Rendered expanded example:

```text
🎬 Scene Setup
Expected Scene: I visit the adventurer's guild
Chaos Factor: 5
Scene Check Roll: 7
Result: Normal Scene
Provider: Demo Oracle
Explanation: The scene proceeds as expected.
```

The scene handling must be easy to extend later with random event focus, event meaning, NPC lists, threads, or other oracle tables.

## Combat Command

### Syntax

```md
/combat
```

### Behavior

The command:

1. Creates combat state for the active session if one does not exist.
2. Activates combat mode.
3. Opens or focuses the combat panel.
4. Inserts a combat-started result block into the document.

Rendered block:

```text
⚔️ Combat started.
```

Combat panel behavior:

- Manual combatant creation.
- Manual initiative input.
- Sort by initiative descending.
- Show active combatant prominently.
- Next Turn button.
- Previous Turn button.
- Link combatants to character sheets optionally.
- Remain system-agnostic.

No automatic initiative formulas in MVP.

## Stat Command

### Syntax

```md
/stat [character sheet name] [stat name] [+/- value]
```

Examples:

```md
/stat Kael HP -4
/stat "Kael Voss" HP -4
/stat "Bandit A" HP -2
/stat Kael Gold +50
```

### Behavior

The command:

1. Finds a character sheet in the active session by name.
2. Finds a numeric field by stat name.
3. Applies the signed delta.
4. Clamps to min/max if configured.
5. Updates the sheet immediately.
6. Inserts a stat-change result block.

Rendered block:

```text
📉 Stat changed
Kael — HP: 20 → 16 (-4)
```

Error examples:

```text
⚠️ Character sheet not found: Kael
⚠️ Stat not found on Kael: HP
⚠️ Stat is not numeric: Notes
```

## Chaos Command

### Syntax

```md
/chaos +1
/chaos -1
```

### Behavior

The command:

1. Reads the active session Chaos Factor.
2. Applies the delta.
3. Clamps the result between 1 and 9.
4. Updates the session.
5. Inserts a chaos-change result block.

Rendered block:

```text
🌀 Chaos Factor changed: 5 → 6 (+1)
```

Default Chaos Factor for new sessions: `5`.

The Chaos Factor should also be manually editable in the right panel.

## Character Sheet Builder

The character sheet builder must be freeform and system-agnostic.

Required actions:

- Create character sheet.
- Rename character sheet.
- Delete character sheet.
- Add field.
- Edit field.
- Delete field.
- Reorder fields if easy.
- Set field group.
- Set field type.
- Set min/max for number fields.
- Create template from existing sheet.
- Create new sheet from template.
- Set active character sheet.

Required field types:

```text
number
text
boolean
longText
```

Multiple character sheets can exist in one session.

The right panel should allow switching between sheets.

## Oracle Provider Architecture

Create a clean provider interface.

```ts
type OracleProvider = {
  id: string
  name: string
  description: string
  askYesNo(input: AskOracleInput): AskOracleResult
  setupScene(input: SceneSetupInput): SceneSetupResult
}
```

```ts
type AskOracleInput = {
  question: string
  odds: OracleOdds
  d100: number
  chaosFactor: number
}
```

```ts
type AskOracleResult = {
  question: string
  odds: OracleOdds
  roll: number
  answer: "Yes" | "No"
  exceptional: boolean
  chaosFactor: number
  providerId: string
  providerName: string
  explanation: string
}
```

```ts
type SceneSetupInput = {
  prompt: string
  roll: number
  chaosFactor: number
}
```

```ts
type SceneSetupResult = {
  prompt: string
  roll: number
  chaosFactor: number
  adjustmentType: string
  providerId: string
  providerName: string
  explanation: string
}
```

### Demo Oracle Provider

Include a demo oracle provider out of the box.

Label it clearly:

```text
Demo Oracle — not Mythic GME 2e
```

Demo `/ask` behavior can be simple:

- d100 <= 50 means Yes.
- d100 > 50 means No.
- Doubles are exceptional.

Demo `/scene` behavior can be simple:

- 1-3: Altered Scene
- 4-6: Interrupt Scene
- 7-10: Normal Scene

### Guidance for Extending Oracle Providers

Add documentation in the codebase explaining how to create a new oracle provider.

Required doc file:

```text
docs/oracle-providers.md
```

It should explain:

1. How to implement `OracleProvider`.
2. How to register a provider.
3. How `/ask` uses the provider.
4. How `/scene` uses the provider.
5. How external/user-provided table data can be loaded later.
6. That proprietary oracle tables should not be hardcoded unless the user has the right to use them.

## Result Block Behavior

All command results are block-level Tiptap nodes.

Result blocks:

- Can be selected.
- Can be deleted with Backspace/Delete.
- Are destroyed when deleted.
- Support normal undo if editor history supports it.
- Oracle result blocks are collapsible.
- Scene result blocks are collapsible.
- Roll/stat/combat/chaos blocks do not need collapse behavior, but may use the same block framework.

Required result block types:

```text
roll
oracle
scene
combat
stat
chaos
error
```

## Error Handling

Errors must not crash the editor.

Invalid roll:

```text
⚠️ Invalid roll: cat
```

Unknown command:

```text
⚠️ Unknown command: /foo
```

Missing sheet:

```text
⚠️ Character sheet not found: Kael
```

Missing stat:

```text
⚠️ Stat not found on Kael: HP
```

Invalid Chaos Factor:

```text
⚠️ Chaos Factor must stay between 1 and 9.
```

## Suggested Source Structure

```text
src/
  app/
    App.tsx
    layout/
    routes/
  editor/
    Editor.tsx
    extensions/
      SlashCommandExtension.ts
      ResultBlockExtension.ts
    resultBlocks/
      RollResultBlock.tsx
      OracleResultBlock.tsx
      SceneResultBlock.tsx
      CombatResultBlock.tsx
      StatResultBlock.tsx
      ChaosResultBlock.tsx
      ErrorResultBlock.tsx
  commands/
    parseCommand.ts
    executeCommand.ts
    commandTypes.ts
  dice/
    rollDice.ts
    diceParser.ts
    diceTypes.ts
  oracle/
    OracleProvider.ts
    DemoOracleProvider.ts
    oracleRegistry.ts
    oracleTypes.ts
  scene/
    sceneTypes.ts
    setupScene.ts
  characterSheets/
    CharacterSheetPanel.tsx
    CharacterSheetBuilder.tsx
    CharacterSheetTemplatePanel.tsx
    characterSheetTypes.ts
    characterSheetLogic.ts
  combat/
    CombatPanel.tsx
    combatTypes.ts
    combatLogic.ts
  persistence/
    database.ts
    migrations.ts
    sessionRepository.ts
    documentRepository.ts
    characterSheetRepository.ts
    combatRepository.ts
    settingsRepository.ts
  state/
    appStore.ts
  docs/
    oracle-providers.md
  tests/
    commandParser.test.ts
    dice.test.ts
    oracle.test.ts
    scene.test.ts
    statCommand.test.ts
    chaosCommand.test.ts
```

Tauri side:

```text
src-tauri/
  src/
    main.rs
    commands.rs
    sqlite.rs
```

## Testing Requirements

Use Vitest for TypeScript domain tests.

Minimum tests:

### Command parser

- Parses `/roll 1d20+3`.
- Parses `/ask Is the door locked?`.
- Parses `/ask likely Is the guard asleep?`.
- Parses `/ask very_likely Is the town nearby?`.
- Parses `/scene "I visit the guild"`.
- Parses `/combat`.
- Parses `/stat Kael HP -4`.
- Parses `/stat "Kael Voss" HP -4`.
- Parses `/chaos +1`.
- Rejects unknown command gracefully.

### Dice roller

- `1d20` works.
- `d20` becomes `1d20`.
- `1d20+3` works.
- `2d6-1` works.
- `1d20+1d4+2` works.
- Invalid notation returns error.
- Excessive dice count returns error.
- Excessive dice sides returns error.

### Oracle

- Demo oracle answers Yes/No.
- Demo oracle detects exceptional doubles.
- Demo oracle handles odds input even if simplified.
- Oracle provider registry returns active provider.

### Scene

- Scene setup returns prompt, roll, Chaos Factor, and adjustment.
- Demo scene provider returns valid adjustment type.
- Scene logic is provider-driven.

### Stat command

- Updates a named sheet stat.
- Supports quoted sheet names.
- Clamps to min/max.
- Errors if sheet is missing.
- Errors if stat is missing.
- Errors if stat is non-numeric.

### Chaos command

- Applies `+1`.
- Applies `-1`.
- Clamps minimum to 1.
- Clamps maximum to 9.

### Templates

- Creates template from sheet.
- Creates new sheet from template.
- Preserves field names, types, groups, min/max, and default values.

## MVP Completion Criteria

The MVP is complete when this scenario works:

1. Launch portable desktop app.
2. Create session:
   - Name: `Session 1`
   - Chaos Factor defaults to `5`
3. Create character sheets:
   - `Kael`
     - HP number, value 20, min 0, max 20
     - STR number, value 14
   - `Mira`
     - HP number, value 12, min 0, max 12
4. Create a template from `Kael`.
5. Create a new sheet from that template.
6. In the editor, type:

```md
/scene "I visit the adventurer's guild"
```

Expected:
- Collapsible scene block appears.
- It contains prompt, Chaos Factor, roll, and result.

7. Type prose:

```md
I ask around for suspicious rumors.
```

8. Type:

```md
/ask likely Is the guildmaster hiding something?
```

Expected:
- Collapsible oracle block appears.
- It contains odds, Chaos Factor, d100, answer, exceptional status, and provider.

9. Type:

```md
/roll 1d20+3
```

Expected:
- Roll block appears.
- It contains total and individual roll breakdown.

10. Type:

```md
/combat
```

Expected:
- Combat panel opens.
- Combat started block appears.

11. Add combatant manually:
   - Name: Bandit
   - Initiative: 12

12. Type:

```md
/stat Kael HP -4
```

Expected:
- Kael HP changes from 20 to 16.
- Stat result block appears.

13. Type:

```md
/chaos +1
```

Expected:
- Chaos Factor changes from 5 to 6.
- Chaos result block appears.

14. Close and reopen app.

Expected:
- Session persists.
- Document persists.
- Result blocks persist.
- Character sheets persist.
- Combat state persists.
- Chaos Factor persists.

## Implementation Strategy

Do not ask Codex to build the entire app in one step.

Instead, use the separate feature tickets document. Each ticket should be implementable in one Codex pass.
