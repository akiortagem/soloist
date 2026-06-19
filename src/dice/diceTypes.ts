export const MAX_DICE_COUNT = 100;
export const MAX_DICE_SIDES = 10000;
export const MAX_FORMULA_LENGTH = 100;
export const MAX_ROLLS_PER_TERM = 1000;

export type DiceErrorCode =
  | "EMPTY_FORMULA"
  | "FORMULA_TOO_LONG"
  | "INVALID_FORMULA"
  | "TOO_MANY_DICE"
  | "INVALID_DICE_COUNT"
  | "TOO_MANY_SIDES"
  | "INVALID_SIDES"
  | "INVALID_KEEP_COUNT"
  | "INVALID_EXPLODE_TARGET"
  | "TOO_MANY_ROLLS";

export type DiceRollError = {
  code: DiceErrorCode;
  message: string;
};

export type DiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DiceRollError };

export type KeepMode = "highest" | "lowest";

export type DiceTerm = {
  type: "dice";
  sign: 1 | -1;
  notation: string;
  count: number;
  sides: number;
  keep?: {
    mode: KeepMode;
    count: number;
  };
  explodeOn?: number;
};

export type ModifierTerm = {
  type: "modifier";
  sign: 1 | -1;
  notation: string;
  value: number;
};

export type ParsedDiceTerm = DiceTerm | ModifierTerm;

export type ParsedDiceFormula = {
  formula: string;
  terms: ParsedDiceTerm[];
};

export type DieRoll = {
  value: number;
  kept: boolean;
  exploded: boolean;
};

export type DiceRollBreakdownTerm =
  | {
      type: "dice";
      notation: string;
      sign: 1 | -1;
      count: number;
      sides: number;
      rolls: DieRoll[];
      keptValues: number[];
      subtotal: number;
      keep?: DiceTerm["keep"];
      explodeOn?: number;
    }
  | {
      type: "modifier";
      notation: string;
      sign: 1 | -1;
      value: number;
      subtotal: number;
    };

export type DiceRoll = {
  formula: string;
  total: number;
  terms: DiceRollBreakdownTerm[];
};

export type RandomNumberGenerator = () => number;
