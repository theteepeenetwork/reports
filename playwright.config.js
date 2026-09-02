// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/* The app is static, so the "server" is just a file server over the repo root.
   Tests must never reach the real Firebase project — every spec blocks the SDK
   at the network layer and installs a fake (see tests/fixtures.js). */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desk',  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Chromium, not WebKit: the app branches on (pointer:coarse) and width,
    // and Chromium is the only engine CI installs.
    { name: 'class', use: { ...devices['Desktop Chrome'], viewport: { width: 900, height: 1200 },
                            hasTouch: true, isMobile: true } }
  ],
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    // python's http.server logs every single request, which buries the test
    // results in a few hundred lines of 200s. Keep stderr so a real failure
    // to start still surfaces.
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
