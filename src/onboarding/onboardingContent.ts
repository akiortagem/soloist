import type {
  CombatantTrackedField,
  CharacterTemplateItem,
  Document,
} from "../domain/domainTypes";
import {
  createFieldsFromTemplate,
  createTemplateField,
  createTemplateGroup,
  createTemplateLayout,
  createTemplateLayoutColumn,
  normalizeTemplateItems,
} from "../characterSheets/characterSheetTemplateLogic";
import type { CharacterSheetRepository } from "../persistence/characterSheetRepository";
import type { CombatRepository } from "../persistence/combatRepository";
import type { DocumentRepository } from "../persistence/documentRepository";
import { createId } from "../persistence/id";
import type { SessionRepository } from "../persistence/sessionRepository";
import type { SettingsRepository } from "../persistence/settingsRepository";

const ONBOARDING_SEEDED_KEY = "onboarding_content_seeded";

let onboardingContentPromise: Promise<void> | undefined;

type OnboardingRepositories = {
  characterSheets: CharacterSheetRepository;
  combat: CombatRepository;
  documents: DocumentRepository;
  sessions: SessionRepository;
  settings: SettingsRepository;
};

function createOnboardingTemplateFields(): CharacterTemplateItem[] {
  return normalizeTemplateItems([
    createTemplateLayout({
      columns: [
        createTemplateLayoutColumn({
          fields: [
            createTemplateGroup({
              name: "Stats",
              fields: [
                createTemplateField({
                  name: "STR",
                  type: "number",
                  defaultValue: 2,
                }),
                createTemplateField({
                  name: "MAG",
                  type: "number",
                  defaultValue: 1,
                }),
                createTemplateField({
                  name: "DEF",
                  type: "number",
                  defaultValue: 1,
                }),
              ],
            }),
          ],
        }),
        createTemplateLayoutColumn({
          fields: [
            createTemplateField({
              name: "HP",
              type: "current_max_number",
              defaultValue: { current: 12, max: 12 },
            }),
            createTemplateField({
              name: "MP",
              type: "current_max_number",
              defaultValue: { current: 6, max: 6 },
            }),
          ],
        }),
      ],
    }),
  ]);
}

function createCampaignMarkdown() {
  return [
    "# Welcome to Soloist",
    "",
    "Soloist is a local-first notebook for solo tabletop roleplaying. This starter campaign is safe to edit or delete after you have looked around.",
    "",
    "## Everything is Markdown",
    "",
    "Every normal document and session is saved as Markdown. Headings, paragraphs, bold text, italic text, and bullet lists round-trip through the editor and are stored in the local SQLite database.",
    "",
    "## Rename This Campaign",
    "",
    "The title at the top of this campaign document is editable. Rename it when you start your own game; the campaign name in the sidebar updates with it.",
    "",
    "## How Docs Are Organized",
    "",
    "- The Characters folder holds character documents linked to character sheets.",
    "- The Sessions folder holds play logs where slash commands are available.",
    "- You can add folders and documents inside the campaign tree to organize scenes, locations, NPCs, clues, or rules notes.",
    "- The campaign document is the overview page for the whole game.",
    "",
    "## Character Sheets",
    "",
    "Character sheets can be built from reusable templates. The sample template uses a two-column layout: stats on the left, resources on the right. The sample character is linked to that template and can be targeted by `/stat` commands with the nick `mira`.",
    "",
    "## Combat Tracker",
    "",
    "The tracker in the right panel keeps combatants, turn order, rounds, and a few important fields visible while you play. Mira Ash is already on the tracker with HP, MP, and STR linked from her character sheet, so changing those values in the tracker updates the sheet too. Use Add to add more combatants, Previous Turn and Next Turn to move through turns, and `/combat` commands inside a session to create combat blocks in your notes.",
    "",
    "## Playing a Session",
    "",
    "Open the sample session in the Sessions folder to see each command in context. Type `/` inside a session document to open the command menu.",
  ].join("\n");
}

function createSampleSessionMarkdown() {
  return [
    "# Session 1 - The Lantern Door",
    "",
    "Try this: put your cursor at the end of any slash command below and press Enter to execute it. The command line will turn into a result block, scene block, or combat block in the session.",
    "",
    "Mira reaches the old watchtower as rain starts to chew at the road. The lock is rusted, but the lantern behind the door is still burning.",
    "",
    "Roll when the outcome is uncertain:",
    "",
    "/roll 2d6+1",
    "",
    "Ask the oracle a yes/no question with optional odds:",
    "",
    '/ask likely "Is the watchtower occupied?"',
    "",
    "Start a scene container for a focused moment of play:",
    "",
    "/scene",
    "",
    "Mira forces the door and takes a splintering hit from the frame.",
    "",
    "/stat mira HP -2",
    "",
    "Raise or lower the campaign chaos factor as the fiction changes:",
    "",
    "/chaos +1",
    "",
    "Begin combat, advance turns, add a turn note block, and end combat:",
    "",
    "/combat begin",
    "",
    "/combat turn",
    "",
    "/combat block",
    "",
    "/combat end",
    "",
    "If a combat tracker is active, tracker stats can be changed directly:",
    "",
    '/stat tracker "Bandit" Guard +1',
    "",
    "The lantern flares blue, the rain stops all at once, and Mira writes the omen down before the tower can forget it.",
  ].join("\n");
}

function createLoreMarkdown() {
  return [
    "# The Lantern Door",
    "",
    "Local stories say the watchtower lantern burns only when someone nearby has made a promise they cannot keep.",
    "",
    "- The flame is blue in rain.",
    "- The door has no handle on the inside.",
    "- The old road bends toward the tower after sunset.",
  ].join("\n");
}

function findFolder(
  documents: Document[],
  folderKind: NonNullable<Document["folderKind"]>,
) {
  return (
    documents.find(
      (document) =>
        document.kind === "folder" && document.folderKind === folderKind,
    ) ?? null
  );
}

function createTrackedSheetFields(
  fields: Array<{ id: string; name: string }>,
): CombatantTrackedField[] {
  return ["HP", "MP", "STR"].flatMap((fieldName) => {
    const field = fields.find(
      (candidate) =>
        candidate.name.trim().toLocaleLowerCase() ===
        fieldName.toLocaleLowerCase(),
    );

    if (!field) {
      return [];
    }

    return [
      {
        id: createId("combat_field"),
        name: field.name,
        type: "sheet" as const,
        characterFieldId: field.id,
      },
    ];
  });
}

async function seedOnboardingContent(
  repositories: OnboardingRepositories,
) {
  const seededSetting = await repositories.settings.get(ONBOARDING_SEEDED_KEY);

  if (seededSetting) {
    return;
  }

  const existingSessions = await repositories.sessions.list();

  if (existingSessions.length > 0) {
    await repositories.settings.set({
      key: ONBOARDING_SEEDED_KEY,
      valueJson: JSON.stringify({ seeded: false, reason: "existing_content" }),
    });
    return;
  }

  const session = await repositories.sessions.create({
    name: "Welcome to Soloist",
  });
  await repositories.documents.update({
    id: session.documentId,
    contentMarkdown: createCampaignMarkdown(),
  });

  const documents = await repositories.documents.listBySessionId(session.id);
  const charactersFolder = findFolder(documents, "characters");
  const sessionsFolder = findFolder(documents, "sessions");
  const loreFolder = await repositories.documents.create({
    sessionId: session.id,
    kind: "folder",
    title: "Lore",
  });
  await repositories.documents.create({
    sessionId: session.id,
    parentId: loreFolder.id,
    kind: "document",
    title: "The Lantern Door",
    contentMarkdown: createLoreMarkdown(),
  });
  const templateFields = createOnboardingTemplateFields();
  const template = await repositories.characterSheets.createTemplate({
    name: "Starter Adventurer",
    fields: templateFields,
  });
  const sheet = await repositories.characterSheets.create({
    sessionId: session.id,
    name: "Mira Ash",
    nick: "mira",
    templateId: template.id,
    templateName: template.name,
    fields: createFieldsFromTemplate(template.fields),
  });

  if (charactersFolder) {
    await repositories.documents.create({
      sessionId: session.id,
      parentId: charactersFolder.id,
      kind: "character",
      characterSheetId: sheet.id,
      title: sheet.name,
      contentMarkdown: "Mira Ash is a road-worn seeker following rumors of a lantern that burns without oil.",
    });
  }

  if (sessionsFolder) {
    await repositories.documents.create({
      sessionId: session.id,
      parentId: sessionsFolder.id,
      kind: "session",
      title: "Session 1 - The Lantern Door",
      contentMarkdown: createSampleSessionMarkdown(),
    });
  }

  await repositories.combat.upsert({
    sessionId: session.id,
    active: false,
    combatants: [
      {
        id: createId("combatant"),
        name: sheet.name,
        turnOrder: 1,
        characterSheetId: sheet.id,
        fields: createTrackedSheetFields(sheet.fields),
      },
    ],
    currentTurnIndex: 0,
    roundNumber: 1,
  });
  await repositories.sessions.update({
    id: session.id,
    activeCharacterSheetId: sheet.id,
  });
  await repositories.settings.set({
    key: ONBOARDING_SEEDED_KEY,
    valueJson: JSON.stringify({ seeded: true, version: 1 }),
  });
}

export function ensureOnboardingContent(repositories: OnboardingRepositories) {
  onboardingContentPromise ??= seedOnboardingContent(repositories).finally(() => {
    onboardingContentPromise = undefined;
  });

  return onboardingContentPromise;
}
