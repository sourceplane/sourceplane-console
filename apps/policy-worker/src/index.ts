export * from "./app.js";
export * from "./domain/engine.js";
export * from "./env.js";

import { createPolicyWorkerApp } from "./app.js";

const worker = createPolicyWorkerApp();

export default worker;