import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        // Node globals
        process: 'readonly',
        __dirname: 'readonly',
        // Service Worker globals
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-console': 'warn',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-useless-escape': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  }
);
