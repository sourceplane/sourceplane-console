export * from "./app.js";
export * from "./domain/service.js";
export * from "./env.js";

import { createProjectsWorkerApp } from "./app.js";

const worker = createProjectsWorkerApp();

export default worker;
