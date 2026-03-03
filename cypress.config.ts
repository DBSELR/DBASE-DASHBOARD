import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:25918",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});