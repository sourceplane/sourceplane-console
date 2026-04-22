import globals from "globals";

import { baseConfig } from "./base.mjs";

const reactConfig = [
  ...baseConfig,
  {
    files: ["**/*.tsx", "**/*.jsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024
      }
    }
  }
];

export default reactConfig;
