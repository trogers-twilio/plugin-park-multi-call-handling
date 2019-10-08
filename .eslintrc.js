module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    'react',
  ],
  rules: {
    'import/no-extraneous-dependencies': 0,
    'prefer-arrow-callback': 0,
    'func-names': 0,
    'class-methods-use-this': 0,
    'react/jsx-filename-extension': 0,
    'comma-dangle': 0,
    'react/jsx-fragments': 0,
    'no-console': 0,
    'react/prop-types': 0
  },
};
