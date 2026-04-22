import globals from "globals";

import { baseConfig } from "./base.mjs";

const workerConfig = [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.mts"],
    languageOptions: {
      globals: {
        ...globals.es2024,
        ...globals.serviceworker
      }
    }
  }
];

export default workerConfig;
