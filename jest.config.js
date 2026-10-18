const preset = require('jest-expo/jest-preset');

// Jest runs ONLY the component/hook tests (`*.test.tsx`). Pure-logic tests (`*.test.ts`) belong to
// `node:test` (`npm run test:logic`); the extension decides the runner, so the two never overlap.

// The Redux packages ship an ESM build under the "react-native" export condition, which Jest
// (CommonJS) cannot load untransformed. `jest-expo` already transforms the React Native/Expo ones;
// this adds Redux, keeping the rest of its patterns.
const [expoPattern, ...otherPatterns] = preset.transformIgnorePatterns;
const transformIgnorePatterns = [
  expoPattern.replace('(.pnpm|', '(.pnpm|react-redux|@reduxjs/toolkit|immer|reselect|redux|'),
  ...otherPatterns,
];

module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns,
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
