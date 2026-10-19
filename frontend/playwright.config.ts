import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./qa",
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    colorScheme: "dark",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: "npm --prefix .. run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
