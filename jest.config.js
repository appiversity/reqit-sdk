module.exports = {
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/parser/grammar.js',
  ],
  coverageThreshold: {
    global: {
      lines: 95,
      branches: 90,
    },
  },
};
