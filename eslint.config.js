// https://docs.expo.dev/guides/using-eslint/
// ESLint 9 flat config.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const reactPlugin = require("eslint-plugin-react");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const unusedImports = require("eslint-plugin-unused-imports");
const prettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  {
    ignores: [
      "next-env.d.ts",
      ".expo/**",
      ".vscode/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "src/assets/**",
      "src/generated/**",
      "src-tauri/**",
      "*.mjs",
      "package-lock.json",
      "**/*.md",
    ],
  },
  ...expoConfig,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImports,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      // TypeScript
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      // React
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
      "react/no-array-index-key": "off",
      // Unused imports
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      // Enforce @/ alias for cross-module imports.
      // Same-folder relative imports (./file) are still allowed for co-located files.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message: "Use the '@/' path alias for cross-module imports instead of '../' relative paths.",
            },
          ],
        },
      ],
    },
  },
  prettierRecommended,
]);
