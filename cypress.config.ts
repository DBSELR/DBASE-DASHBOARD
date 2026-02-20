import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "https://api.dbasesolutions.in",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});