import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "migrations/**",
      "scripts/**",
      // CommonJS seeders managed by sequelize-cli
      "src/seeders/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Gradual cleanup: surface `any` usage as warnings without blocking builds
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Express handlers commonly return res.json(...) for early exits
      "@typescript-eslint/no-misused-promises": "off",
      // Gradual cleanup: rethrown errors should attach { cause }
      "preserve-caught-error": "warn",
      // `declare global { namespace Express }` is the standard way to extend req.user
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  }
);
