import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          // Base D1 isolée en mémoire pour les tests — jamais la vraie base.
          d1Databases: ["DB"],
        },
      },
    },
  },
});
