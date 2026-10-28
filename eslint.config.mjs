import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const features = ["dashboard", "assistant", "alerts", "navigation"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-config-next registers jsx-a11y but enables only a few rules; turn on the full recommended set.
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/no-autofocus": "error",

      // CLAUDE.md hard rules: no `any`, no `as` casts (`as const` is still allowed), no non-null escapes.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",

      "react/button-has-type": "error",
      // Model output is rendered through react-markdown only.
      "react/no-danger": "error",

      // Layer boundaries: features never import each other; lower layers never import upwards.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            ...features.map((feature) => ({
              target: `./src/features/${feature}`,
              from: "./src/features",
              except: [`./${feature}`],
              message:
                "Features never import each other; move shared code into data/, domain/ or ui/.",
            })),
            {
              target: ["./src/data", "./src/domain", "./src/state", "./src/ui"],
              from: ["./src/features", "./src/app"],
              message: "Lower layers never import from features or routes.",
            },
            {
              target: "./src/domain",
              from: ["./src/data", "./src/state", "./src/ui"],
              message:
                "domain/ is pure: schemas, selectors and formatters only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom"],
          patterns: ["next", "next/*"],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".pnpm-store/**",
  ]),
]);

export default eslintConfig;
