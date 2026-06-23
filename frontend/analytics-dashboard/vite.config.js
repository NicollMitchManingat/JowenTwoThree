import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    dedupe: ["react", "react-dom"],
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    deps: {
      inline: ["react", "react-dom"],
    },
  },
});