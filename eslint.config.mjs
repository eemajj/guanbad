import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Folder boundaries (see docs/ARCHITECTURE.md). Type-only imports are always allowed.
 *   domain/  pure logic: imports nothing from the app
 *   lib/     shared helpers for server and browser: no server, features, ui
 *   ui/      design system: may use domain and lib, never features or server
 *   app/ and feature components: no direct database access (use features/<x>/queries.ts)
 */
const restrict = (files, patterns) => ({
  files,
  rules: { "@typescript-eslint/no-restricted-imports": ["error", { patterns: patterns.map((p) => ({ ...p, allowTypeImports: true })) }] },
});
const noDb = {
  group: ["@/server/db", "@prisma/client"],
  message: "Read data through features/<name>/queries.ts, not the database directly.",
};

const boundaries = [
  restrict(
    ["src/domain/**"],
    [{ group: ["@/*", "next/*", "react", "@prisma/client"], message: "domain/ is pure logic: no app, framework or database imports." }],
  ),
  restrict(
    ["src/lib/**"],
    [{ group: ["@/server/*", "@/features/*", "@/ui/*", "@/app/*"], message: "lib/ is shared by server and browser code." }],
  ),
  restrict(
    ["src/ui/**"],
    [{ group: ["@/server/*", "@/features/*", "@/app/*"], message: "ui/ must not know about features or the server." }],
  ),
  restrict(["src/app/**", "src/features/*/components/**"], [noDb]),
];

const config = [
  { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  ...boundaries,
];

export default config;
