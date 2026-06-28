import { FormEvent, useMemo, useState } from "react";
import type { Combatant, CombatantTrackedField } from "./combatTypes";
import type {
  CharacterField,
  CharacterSheet,
  CurrentMaxNumberValue,
} from "../characterSheets/characterSheetTypes";
import { appStore, useAppStore } from "../state/appStore";

type FieldDraft = {
  id: string;
  name: string;
  type: Exclude<CombatantTrackedField["type"], "sheet">;
  value: string;
  maxValue: string;
  booleanValue: boolean;
};

type AddTab = "impromptu" | "characterSheet";

const MAX_TRACKED_FIELDS = 3;
const MAX_TEXT_FIELD_LENGTH = 15;

function createFieldId() {
  return `combat_field_${crypto.randomUUID()}`;
}

function createFieldDraft(): FieldDraft {
  return {
    id: createFieldId(),
    name: "",
    type: "number",
    value: "",
    maxValue: "",
    booleanValue: false,
  };
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNonNegativeNumber(value: string, fallback: number) {
  return Math.max(0, parseNumber(value, fallback));
}

function getCurrentMaxValue(value: CharacterField["value"]): CurrentMaxNumberValue {
  if (value && typeof value === "object") {
    const candidate = value as Partial<CurrentMaxNumberValue>;

    return {
      current:
        typeof candidate.current === "number" &&
        Number.isFinite(candidate.current)
          ? Math.max(0, candidate.current)
          : 0,
      max:
        typeof candidate.max === "number" && Number.isFinite(candidate.max)
          ? Math.max(0, candidate.max)
          : 0,
    };
  }

  return {
    current: 0,
    max: 0,
  };
}

function fieldDraftToTrackedField(
  draft: FieldDraft,
): CombatantTrackedField | null {
  const name = draft.name.trim();

  if (!name) {
    return null;
  }

  if (draft.type === "boolean") {
    return {
      id: createFieldId(),
      name,
      type: "boolean",
      value: draft.booleanValue,
    };
  }

  if (draft.type === "text") {
    return {
      id: createFieldId(),
      name,
      type: "text",
      value: draft.value.slice(0, MAX_TEXT_FIELD_LENGTH),
    };
  }

  const minValue = 0;
  const maxValue = Math.max(minValue, parseNumber(draft.maxValue, minValue));
  const value = Math.min(maxValue, Math.max(minValue, parseNumber(draft.value, maxValue)));

  return {
    id: createFieldId(),
    name,
    type: "number",
    value,
    minValue,
    maxValue,
  };
}

function getGaugePercent(field: Extract<CombatantTrackedField, { type: "number" }>) {
  if (field.maxValue <= field.minValue) {
    return 100;
  }

  return Math.min(
    100,
    Math.max(0, ((field.value - field.minValue) / (field.maxValue - field.minValue)) * 100),
  );
}

function getGaugeClassName(percent: number) {
  if (percent <= 30) {
    return "combat-gauge danger";
  }

  if (percent <= 50) {
    return "combat-gauge warning";
  }

  return "combat-gauge";
}

function getCurrentMaxGaugePercent(value: CurrentMaxNumberValue) {
  if (value.max <= 0) {
    return 100;
  }

  return Math.min(100, Math.max(0, (value.current / value.max) * 100));
}

function updateCombatantField(
  combatant: Combatant,
  fieldId: string,
  nextField: CombatantTrackedField,
) {
  void appStore.updateCombatant({
    ...combatant,
    fields: (combatant.fields ?? []).map((field) =>
      field.id === fieldId ? nextField : field,
    ),
  });
}

function CombatantFieldControl({
  combatant,
  field,
  linkedField,
}: {
  combatant: Combatant;
  field: CombatantTrackedField;
  linkedField?: CharacterField | null;
}) {
  if (field.type === "sheet") {
    return (
      <LinkedCharacterFieldControl
        combatant={combatant}
        field={field}
        linkedField={linkedField}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="combat-field combat-field-boolean">
        <span>{field.name}</span>
        <button
          aria-label={`${field.name} ${field.value ? "checked" : "unchecked"}`}
          className={field.value ? "checked" : ""}
          onClick={() =>
            updateCombatantField(combatant, field.id, {
              ...field,
              value: !field.value,
            })
          }
          type="button"
        >
          {field.value ? "✓" : ""}
        </button>
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <label className="combat-field combat-field-text">
        <span>{field.name}</span>
        <input
          maxLength={MAX_TEXT_FIELD_LENGTH}
          onChange={(event) =>
            updateCombatantField(combatant, field.id, {
              ...field,
              value: event.currentTarget.value.slice(0, MAX_TEXT_FIELD_LENGTH),
            })
          }
          type="text"
          value={field.value.slice(0, MAX_TEXT_FIELD_LENGTH)}
        />
      </label>
    );
  }

  const gaugePercent = getGaugePercent(field);

  return (
    <div className="combat-field combat-field-number">
      <span>{field.name}</span>
      <span className={getGaugeClassName(gaugePercent)} aria-hidden="true">
        <span style={{ width: `${gaugePercent}%` }} />
      </span>
      <input
        aria-label={`${field.name} current value`}
        max={field.maxValue}
        min={field.minValue}
        onChange={(event) =>
          updateCombatantField(combatant, field.id, {
            ...field,
            value: Math.min(
              field.maxValue,
              Math.max(field.minValue, parseNumber(event.currentTarget.value, field.value)),
            ),
          })
        }
        type="number"
        value={field.value}
      />
      <span className="combat-field-max">/ {field.maxValue}</span>
    </div>
  );
}

function LinkedCharacterFieldControl({
  combatant,
  field,
  linkedField,
}: {
  combatant: Combatant;
  field: Extract<CombatantTrackedField, { type: "sheet" }>;
  linkedField?: CharacterField | null;
}) {
  if (!combatant.characterSheetId || !linkedField) {
    return (
      <div className="combat-field combat-field-linked-missing">
        <span>{field.name}</span>
        <strong>Missing sheet field</strong>
      </div>
    );
  }

  // Linked tracker fields intentionally read and write the character sheet.
  // Combat state stores only the chosen sheet field id so /stat and sheet edits
  // are reflected in the tracker without duplicating resource values.
  if (linkedField.type === "current_max_number") {
    const value = getCurrentMaxValue(linkedField.value);
    const gaugePercent = getCurrentMaxGaugePercent(value);

    return (
      <div className="combat-field combat-field-number">
        <span>{linkedField.name}</span>
        <span className={getGaugeClassName(gaugePercent)} aria-hidden="true">
          <span style={{ width: `${gaugePercent}%` }} />
        </span>
        <input
          aria-label={`${linkedField.name} current value`}
          min={0}
          onChange={(event) =>
            void appStore.updateCharacterSheetField(
              combatant.characterSheetId!,
              linkedField.id,
              {
                ...value,
                current: parseNonNegativeNumber(
                  event.currentTarget.value,
                  value.current,
                ),
              },
            )
          }
          type="number"
          value={value.current}
        />
        <span className="combat-field-max">/ {value.max}</span>
      </div>
    );
  }

  if (linkedField.type === "number") {
    return (
      <div className="combat-field combat-field-plain-number">
        <span>{linkedField.name}</span>
        <strong>
          {typeof linkedField.value === "number" ? linkedField.value : 0}
        </strong>
      </div>
    );
  }

  if (linkedField.type === "boolean") {
    return (
      <div className="combat-field combat-field-plain-number">
        <span>{linkedField.name}</span>
        <strong>{linkedField.value === true ? "Yes" : "No"}</strong>
      </div>
    );
  }

  return (
    <div className="combat-field combat-field-linked-text">
      <span>{linkedField.name}</span>
      <strong>{String(linkedField.value)}</strong>
    </div>
  );
}

export function CombatPanel() {
  const { activeSession, characterSheets, combatState } = useAppStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>("impromptu");
  const [name, setName] = useState("");
  const [turnOrder, setTurnOrder] = useState("1");
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([]);
  const [sheetQuery, setSheetQuery] = useState("");
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [fieldQueries, setFieldQueries] = useState<string[]>([""]);
  const [selectedSheetFieldIds, setSelectedSheetFieldIds] = useState<string[]>(
    [],
  );
  const [sheetFieldSlotCount, setSheetFieldSlotCount] = useState(1);
  const activeCombatant = useMemo(
    () => combatState?.combatants[combatState.currentTurnIndex] ?? null,
    [combatState],
  );
  const selectedSheet = useMemo(
    () =>
      characterSheets.find((sheet) => sheet.id === selectedSheetId) ?? null,
    [characterSheets, selectedSheetId],
  );
  const filteredSheets = useMemo(() => {
    const query = sheetQuery.trim().toLocaleLowerCase();

    return characterSheets.filter((sheet) =>
      sheet.name.trim().toLocaleLowerCase().includes(query),
    );
  }, [characterSheets, sheetQuery]);
  const selectedSheetFields = useMemo(
    () =>
      selectedSheetFieldIds
        .map((fieldId) =>
          selectedSheet?.fields.find((field) => field.id === fieldId),
        )
        .filter((field): field is CharacterField => Boolean(field)),
    [selectedSheet, selectedSheetFieldIds],
  );
  const characterSheetsById = useMemo(() => {
    const byId = new Map<string, CharacterSheet>();

    for (const sheet of characterSheets) {
      byId.set(sheet.id, sheet);
    }

    return byId;
  }, [characterSheets]);

  function updateFieldDraft(index: number, patch: Partial<FieldDraft>) {
    setFieldDrafts((drafts) =>
      drafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function resetForm() {
    setAddTab("impromptu");
    setName("");
    setTurnOrder("1");
    setFieldDrafts([]);
    setSheetQuery("");
    setSelectedSheetId("");
    setFieldQueries([""]);
    setSelectedSheetFieldIds([]);
    setSheetFieldSlotCount(1);
  }

  function closeAddModal() {
    resetForm();
    setIsAddModalOpen(false);
  }

  function addTrackedField() {
    setFieldDrafts((drafts) =>
      drafts.length >= MAX_TRACKED_FIELDS ? drafts : [...drafts, createFieldDraft()],
    );
  }

  function openAddModal() {
    setTurnOrder(String((combatState?.combatants.length ?? 0) + 1));
    setIsAddModalOpen(true);
  }

  function removeTrackedField(index: number) {
    setFieldDrafts((drafts) =>
      drafts.filter((_, draftIndex) => draftIndex !== index),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (addTab === "characterSheet") {
      if (!selectedSheet || selectedSheetFields.length === 0) {
        return;
      }

      void appStore
        .addCombatant({
          name: selectedSheet.name,
          turnOrder: Math.max(
            1,
            parseNumber(turnOrder, (combatState?.combatants.length ?? 0) + 1),
          ),
          characterSheetId: selectedSheet.id,
          fields: selectedSheetFields.slice(0, MAX_TRACKED_FIELDS).map((field) => ({
            id: createFieldId(),
            name: field.name,
            type: "sheet",
            characterFieldId: field.id,
          })),
        })
        .then((savedState) => {
          if (savedState) {
            closeAddModal();
          }
        });
      return;
    }

    const fields = fieldDrafts
      .slice(0, 3)
      .map(fieldDraftToTrackedField)
      .filter((field): field is CombatantTrackedField => Boolean(field));

    void appStore
      .addCombatant({
        name,
        turnOrder: Math.max(
          1,
          parseNumber(turnOrder, (combatState?.combatants.length ?? 0) + 1),
        ),
        fields,
      })
      .then((savedState) => {
        if (savedState) {
          closeAddModal();
        }
      });
  }

  function selectSheet(sheet: CharacterSheet) {
    setSelectedSheetId(sheet.id);
    setSheetQuery(sheet.name);
    setFieldQueries([""]);
    setSelectedSheetFieldIds([]);
    setSheetFieldSlotCount(1);
  }

  function getFilteredSheetFieldsForSlot(slotIndex: number) {
    const query = (fieldQueries[slotIndex] ?? "").trim().toLocaleLowerCase();

    return (selectedSheet?.fields ?? []).filter(
      (field) =>
        !selectedSheetFieldIds.includes(field.id) &&
        field.name.trim().toLocaleLowerCase().includes(query),
    );
  }

  function updateFieldQuery(slotIndex: number, value: string) {
    setFieldQueries((queries) => {
      const nextQueries = [...queries];
      nextQueries[slotIndex] = value;
      return nextQueries;
    });
  }

  function selectSheetField(field: CharacterField, slotIndex: number) {
    if (
      selectedSheetFieldIds.length >= MAX_TRACKED_FIELDS ||
      selectedSheetFieldIds.includes(field.id)
    ) {
      return;
    }

    setSelectedSheetFieldIds((fieldIds) => [...fieldIds, field.id]);
    updateFieldQuery(slotIndex, field.name);
  }

  function addSheetFieldSlot() {
    if (
      sheetFieldSlotCount >= MAX_TRACKED_FIELDS ||
      selectedSheetFieldIds.length < sheetFieldSlotCount
    ) {
      return;
    }

    setSheetFieldSlotCount((count) => Math.min(MAX_TRACKED_FIELDS, count + 1));
    setFieldQueries((queries) => [...queries, ""]);
  }

  function removeSelectedSheetField(fieldId: string) {
    setSelectedSheetFieldIds((fieldIds) =>
      fieldIds.filter((candidate) => candidate !== fieldId),
    );
    setSheetFieldSlotCount((count) =>
      Math.max(1, Math.min(count, selectedSheetFieldIds.length - 1 || 1)),
    );
    setFieldQueries((queries) => queries.slice(0, Math.max(1, queries.length - 1)));
  }

  function getLinkedCharacterField(combatant: Combatant, field: CombatantTrackedField) {
    if (field.type !== "sheet" || !combatant.characterSheetId) {
      return null;
    }

    return (
      characterSheetsById
        .get(combatant.characterSheetId)
        ?.fields.find((sheetField) => sheetField.id === field.characterFieldId) ??
      null
    );
  }

  function updateRoundNumber(value: string) {
    const roundNumber = Math.max(
      1,
      Math.floor(parseNumber(value, combatState?.roundNumber ?? 1)),
    );

    void appStore.saveCombatState({
      active: combatState?.active ?? true,
      combatants: combatState?.combatants ?? [],
      currentTurnIndex: combatState?.currentTurnIndex ?? 0,
      roundNumber,
    });
  }

  if (!activeSession) {
    return (
      <section className="combat-panel">
        <h2>Combat Tracker</h2>
        <p>Create a session to track combat.</p>
      </section>
    );
  }

  return (
    <section className="combat-panel">
      <div className="combat-panel-header">
        <h2>Combat Tracker</h2>
        <div className="combat-panel-header-actions">
          <label className="combat-round-counter">
            <span>Round</span>
            <input
              aria-label="Combat round"
              min={1}
              onChange={(event) => updateRoundNumber(event.currentTarget.value)}
              type="number"
              value={combatState?.roundNumber ?? 1}
            />
          </label>
          <button onClick={openAddModal} type="button">
            Add
          </button>
        </div>
      </div>

      <div className="combat-turn-controls">
        <button
          disabled={!combatState?.combatants.length}
          onClick={() => void appStore.previousCombatTurn()}
          type="button"
        >
          Previous Turn
        </button>
        <button
          disabled={!combatState?.combatants.length}
          onClick={() => void appStore.nextCombatTurn()}
          type="button"
        >
          Next Turn
        </button>
      </div>

      {activeCombatant ? (
        <p className="combat-active-line">
          Active: <strong>{activeCombatant.name}</strong>
        </p>
      ) : (
        <p>No combatants yet.</p>
      )}

      <ol className="combatant-list">
        {(combatState?.combatants ?? []).map((combatant, index) => {
          const isActive = combatant.id === activeCombatant?.id;

          return (
            <li className={isActive ? "active" : ""} key={combatant.id}>
              <div className="combatant-heading">
                <div>
                  <strong>{combatant.name}</strong>
                  <span>Turn order {combatant.turnOrder}</span>
                </div>
                <div className="combatant-order-actions">
                  <button
                    aria-label={`Move ${combatant.name} earlier`}
                    disabled={index === 0}
                    onClick={() =>
                      void appStore.moveCombatantTurnOrder(combatant.id, "up")
                    }
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${combatant.name} later`}
                    disabled={index === (combatState?.combatants.length ?? 0) - 1}
                    onClick={() =>
                      void appStore.moveCombatantTurnOrder(combatant.id, "down")
                    }
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove ${combatant.name}`}
                    onClick={() => void appStore.removeCombatant(combatant.id)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>
              {(combatant.fields?.length ?? 0) > 0 && (
                <div className="combatant-fields">
                  {combatant.fields?.map((field) => (
                    <CombatantFieldControl
                      combatant={combatant}
                      field={field}
                      key={field.id}
                      linkedField={getLinkedCharacterField(combatant, field)}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {isAddModalOpen && (
        <div className="combat-modal-backdrop">
          <form className="combat-modal" onSubmit={onSubmit}>
            <div className="combat-modal-header">
              <h3>Add Combatant</h3>
              <button
                aria-label="Close add combatant"
                onClick={closeAddModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="combat-add-tabs" role="tablist">
              <button
                aria-selected={addTab === "impromptu"}
                className={addTab === "impromptu" ? "active" : ""}
                onClick={() => setAddTab("impromptu")}
                role="tab"
                type="button"
              >
                Impromptu
              </button>
              <button
                aria-selected={addTab === "characterSheet"}
                className={addTab === "characterSheet" ? "active" : ""}
                onClick={() => setAddTab("characterSheet")}
                role="tab"
                type="button"
              >
                Character Sheet
              </button>
            </div>

            {addTab === "impromptu" ? (
              <>
                <label>
                  Name
                  <input
                    autoFocus
                    onChange={(event) => setName(event.currentTarget.value)}
                    placeholder="Bandit"
                    required
                    type="text"
                    value={name}
                  />
                </label>
                <label>
                  Turn Order
                  <input
                    min={1}
                    onChange={(event) => setTurnOrder(event.currentTarget.value)}
                    required
                    type="number"
                    value={turnOrder}
                  />
                </label>

                <div className="combat-field-drafts">
                  <div className="combat-field-drafts-header">
                    <span>Tracked Fields</span>
                    <button
                      disabled={fieldDrafts.length >= MAX_TRACKED_FIELDS}
                      onClick={addTrackedField}
                      type="button"
                    >
                      Add Field
                    </button>
                  </div>

                  {fieldDrafts.length === 0 && (
                    <p>No fields tracked for this combatant.</p>
                  )}

                  {fieldDrafts.map((field, index) => (
                    <div className="combat-field-draft" key={field.id}>
                      <label className="combat-field-draft-name">
                        Field name
                        <input
                          aria-label={`Field ${index + 1} name`}
                          onChange={(event) =>
                            updateFieldDraft(index, {
                              name: event.currentTarget.value,
                            })
                          }
                          placeholder="HP"
                          type="text"
                          value={field.name}
                        />
                      </label>
                      <label className="combat-field-draft-type">
                        Type
                        <select
                          aria-label={`Field ${index + 1} type`}
                          onChange={(event) =>
                            updateFieldDraft(index, {
                              type: event.currentTarget.value as FieldDraft["type"],
                            })
                          }
                          value={field.type}
                        >
                          <option value="number">Gauge</option>
                          <option value="text">Text</option>
                          <option value="boolean">Bool</option>
                        </select>
                      </label>
                      {field.type === "boolean" ? (
                        <label className="combat-draft-checkbox">
                          <input
                            checked={field.booleanValue}
                            onChange={(event) =>
                              updateFieldDraft(index, {
                                booleanValue: event.currentTarget.checked,
                              })
                            }
                            type="checkbox"
                          />
                          On
                        </label>
                      ) : field.type === "number" ? (
                        <div className="combat-number-draft-values">
                          <label>
                            Current
                            <input
                              aria-label={`Field ${index + 1} current`}
                              onChange={(event) =>
                                updateFieldDraft(index, {
                                  value: event.currentTarget.value,
                                })
                              }
                              placeholder="20"
                              type="number"
                              value={field.value}
                            />
                          </label>
                          <label>
                            Max
                            <input
                              aria-label={`Field ${index + 1} max`}
                              onChange={(event) =>
                                updateFieldDraft(index, {
                                  maxValue: event.currentTarget.value,
                                })
                              }
                              placeholder="20"
                              type="number"
                              value={field.maxValue}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="combat-text-draft-value">
                          Label value
                          <input
                            aria-label={`Field ${index + 1} value`}
                            maxLength={MAX_TEXT_FIELD_LENGTH}
                            onChange={(event) =>
                              updateFieldDraft(index, {
                                value: event.currentTarget.value.slice(
                                  0,
                                  MAX_TEXT_FIELD_LENGTH,
                                ),
                              })
                            }
                            placeholder="15 chars max"
                            type="text"
                            value={field.value}
                          />
                        </label>
                      )}
                      <button
                        aria-label={`Remove field ${index + 1}`}
                        className="combat-field-draft-remove"
                        onClick={() => removeTrackedField(index)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <label>
                  Turn Order
                  <input
                    min={1}
                    onChange={(event) => setTurnOrder(event.currentTarget.value)}
                    required
                    type="number"
                    value={turnOrder}
                  />
                </label>

                <div className="combat-sheet-picker">
                  <label>
                    Character Sheet
                    <input
                      autoFocus
                      onChange={(event) => {
                        setSheetQuery(event.currentTarget.value);
                        setSelectedSheetId("");
                        setFieldQueries([""]);
                        setSelectedSheetFieldIds([]);
                        setSheetFieldSlotCount(1);
                      }}
                      placeholder="Search sheets"
                      type="search"
                      value={sheetQuery}
                    />
                  </label>
                  <div className="combat-search-options">
                    {filteredSheets.length === 0 ? (
                      <p>No matching sheets.</p>
                    ) : (
                      filteredSheets.map((sheet) => (
                        <button
                          className={
                            sheet.id === selectedSheetId ? "selected" : ""
                          }
                          key={sheet.id}
                          onClick={() => selectSheet(sheet)}
                          type="button"
                        >
                          {sheet.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {selectedSheet ? (
                  <div className="combat-sheet-field-slots">
                    {Array.from({ length: sheetFieldSlotCount }, (_, slotIndex) => {
                      const selectedFieldId = selectedSheetFieldIds[slotIndex];
                      const selectedField = selectedSheet?.fields.find(
                        (field) => field.id === selectedFieldId,
                      );
                      const filteredFields =
                        getFilteredSheetFieldsForSlot(slotIndex);

                      if (selectedField) {
                        return (
                          <div
                            className="combat-selected-field"
                            key={`slot_${slotIndex}`}
                          >
                            <strong>{selectedField.name}</strong>
                            <span>{selectedField.type}</span>
                            <button
                              aria-label={`Remove ${selectedField.name}`}
                              onClick={() =>
                                removeSelectedSheetField(selectedField.id)
                              }
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          className="combat-sheet-picker"
                          key={`slot_${slotIndex}`}
                        >
                          <label>
                            Field {slotIndex + 1}
                            <input
                              onChange={(event) =>
                                updateFieldQuery(
                                  slotIndex,
                                  event.currentTarget.value,
                                )
                              }
                              placeholder="Search fields"
                              type="search"
                              value={fieldQueries[slotIndex] ?? ""}
                            />
                          </label>
                          <div className="combat-search-options">
                            {filteredFields.length === 0 ? (
                              <p>No matching fields.</p>
                            ) : (
                              filteredFields.map((field) => (
                                <button
                                  key={field.id}
                                  onClick={() =>
                                    selectSheetField(field, slotIndex)
                                  }
                                  type="button"
                                >
                                  {field.name}
                                  <span>{field.type}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      className="combat-add-sheet-field"
                      disabled={
                        sheetFieldSlotCount >= MAX_TRACKED_FIELDS ||
                        selectedSheetFieldIds.length < sheetFieldSlotCount
                      }
                      onClick={addSheetFieldSlot}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                ) : null}

                {selectedSheetFields.length === 0 ? (
                  <div className="combat-selected-fields">
                    <span>Tracked Fields</span>
                    <p>Select at least one sheet field.</p>
                  </div>
                ) : null}
              </>
            )}

            <div className="combat-modal-actions">
              <button onClick={closeAddModal} type="button">
                Cancel
              </button>
              <button
                disabled={
                  addTab === "characterSheet" && selectedSheetFields.length === 0
                }
                type="submit"
              >
                {addTab === "characterSheet" ? "Add Sheet" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
