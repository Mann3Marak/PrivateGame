import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    ignores: ['coverage/**', 'playwright-report/**', 'test-results/**', '.next/**']
  }
];

export default config;
