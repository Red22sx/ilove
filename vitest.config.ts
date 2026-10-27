import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts", "supabase/test/**/*.test.ts"], testTimeout: 60_000 } });
