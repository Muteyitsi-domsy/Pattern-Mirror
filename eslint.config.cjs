const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['node_modules/**', 'lib/**', 'frontend/**', '.firebase/**', 'eslint.config.cjs', 'jest.config.js'],
  },
  ...tseslint.configs.recommended
);
