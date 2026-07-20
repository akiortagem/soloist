import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "src-tauri/target/**",
      "test-fixtures/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/tests/**/*", "**/*.test.{js,ts,tsx}"],
    languageOptions: { globals: globals.node },
    rules: { "no-empty": "off" },
  },
);
