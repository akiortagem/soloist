export type CharacterField = {
  id: string;
  name: string;
  type: "number" | "text" | "boolean" | "longText";
  value: string | number | boolean;
  maxValue?: number;
  minValue?: number;
  group?: string;
};

export type CharacterSheet = {
  id: string;
  sessionId: string;
  name: string;
  fields: CharacterField[];
  createdAt: string;
  updatedAt: string;
};
