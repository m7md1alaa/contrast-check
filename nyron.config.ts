import { defineConfig } from "@nyron/cli/config"

export default defineConfig({
  repo: "m7md1alaa/contrast-check",
  projects: {
    "contrastcheck": {
      tagPrefix: "v",
      path: ".",
    },
  },
})
