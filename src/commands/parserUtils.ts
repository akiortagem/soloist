export type ExtractedCommand = {
  commandName?: string;
  argsText: string;
};

export function trimCommandInput(input: string): string {
  return input.trim();
}

export function startsWithSlash(input: string): boolean {
  return trimCommandInput(input).startsWith("/");
}

export function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function extractCommandName(input: string): ExtractedCommand {
  const trimmed = trimCommandInput(input);

  if (!trimmed.startsWith("/")) {
    return { argsText: trimmed };
  }

  const withoutSlash = trimmed.slice(1).trimStart();
  const match = /^([^\s]+)(?:\s+([\s\S]*))?$/.exec(withoutSlash);

  if (!match) {
    return { argsText: "" };
  }

  return {
    commandName: match[1].toLowerCase(),
    argsText: match[2]?.trim() ?? "",
  };
}

export function extractArgsText(input: string): string {
  return extractCommandName(input).argsText;
}

export function parseQuotedString(input: string): {
  value?: string;
  rest: string;
  error?: string;
} {
  const trimmed = input.trimStart();

  if (!trimmed.startsWith('"')) {
    return { rest: trimmed, error: "Input does not start with a quote" };
  }

  let value = "";
  let escaped = false;

  for (let index = 1; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (escaped) {
      value += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      return {
        value,
        rest: trimmed.slice(index + 1).trimStart(),
      };
    }

    value += character;
  }

  return {
    value,
    rest: "",
    error: "Quoted string is missing a closing quote",
  };
}

export function tokenizeArgs(input: string): string[] {
  const tokens: string[] = [];
  let cursor = input.trim();

  while (cursor.length > 0) {
    if (cursor.startsWith('"')) {
      const parsed = parseQuotedString(cursor);
      tokens.push(parsed.value ?? "");
      cursor = parsed.rest.trimStart();
      continue;
    }

    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(cursor);

    if (!match) {
      break;
    }

    tokens.push(match[1]);
    cursor = (match[2] ?? "").trimStart();
  }

  return tokens;
}
