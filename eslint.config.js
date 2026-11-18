import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// `_name` is how this code drops a field from an object (`const { id: _id, ...rest } = x`) or
// leaves an argument unused; tsc's noUnusedLocals catches the rest.
const unusedVars = ['error', {
  argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true,
}]

// `npm run lint` — fails on any finding (`--max-warnings 0`). Type errors are tsc's job
// (`npm run typecheck`), so this runs without type information and stays fast.
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'vite.config.ts.timestamp-*'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // The classic hook rules. The rest of react-hooks 7's recommended set (refs, purity,
      // set-state-in-effect, immutability, globals, …) describes what the React Compiler can
      // optimise; this app does not use the compiler, and reads refs during render on purpose.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': unusedVars,
      // `set.has(x) ? set.delete(x) : set.add(x)` is a toggle, not a mistake.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': unusedVars,
    },
  },
)
