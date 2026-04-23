export * from "./app.js";
export * from "./env.js";

import { createApiEdgeApp } from "./app.js";

const worker = createApiEdgeApp();

export default worker;
