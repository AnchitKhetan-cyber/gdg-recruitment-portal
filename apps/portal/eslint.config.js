import js from "@eslint/js"
import globals from "globals"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"

export default [
  { ignores: ["dist", "node_modules"] },

  // Build tooling runs under Node, not the browser.
  {
    files: ["*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: js.configs.recommended.rules
  },

  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      }
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Marks identifiers referenced from JSX as used, so imports like
      // `motion` in <motion.div> are not reported as dead.
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" }],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  }
]
