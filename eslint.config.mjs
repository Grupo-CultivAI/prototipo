import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // O zod vem de src/lib/zod.ts, que liga as mensagens de validação em português
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs}"],
    ignores: ["src/lib/zod.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "zod", message: "Importe o z de '@/lib/zod' (mensagens de validação em português)." }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
