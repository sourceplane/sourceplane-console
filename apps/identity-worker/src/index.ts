export * from "./app.js";
export * from "./env.js";

import { createIdentityWorkerApp } from "./app.js";

const worker = createIdentityWorkerApp();

export default worker;
