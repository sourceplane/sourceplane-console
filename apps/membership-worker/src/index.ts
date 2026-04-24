export * from "./app.js";
export * from "./domain/service.js";
export * from "./env.js";

import { createMembershipWorkerApp } from "./app.js";

const worker = createMembershipWorkerApp();

export default worker;
