import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de tela da web (19/10): a web exportada (`expo export --platform web`, em `dist-e2e/`) servida por
 * `e2e/servidor.mjs` e a API simulada em cada teste (`e2e/api-falsa.ts`, `page.route` em `/api/**`). Conferem o fluxo
 * da tela de verdade (React Native Web, folhas, painéis) sem o back nem o banco. Não rodam na CI (minutos do Actions):
 * `npm run e2e` antes de mexer nessas telas. `PW_CHROMIUM` aponta um Chromium já instalado, se for preciso.
 */
const PORTA = 8099;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results-e2e',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
      },
    },
  ],
  webServer: {
    // Sem `EXPO_PUBLIC_API_URL`, a web chama a API na mesma origem (`/api`), que os testes simulam.
    command: `npx expo export --platform web --output-dir dist-e2e && node e2e/servidor.mjs dist-e2e ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    env: { EXPO_PUBLIC_API_URL: '' },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
