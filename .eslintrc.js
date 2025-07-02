module.exports = {
  env: {
    browser: true,
    es2020: true,
    node: true,
    webextensions: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    
    // General JavaScript rules
    'no-console': 'off', // Allow console in extension
    'prefer-const': 'error',
    'no-var': 'error',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    
    // Chrome extension specific - allow window in content scripts
    'no-restricted-globals': 'off', // Allow window usage - needed for content scripts
  },
  ignorePatterns: [
    'dist/**/*',
    'node_modules/**/*',
    'webpack.config.js',
  ],
  globals: {
    chrome: 'readonly',
  },
}; 