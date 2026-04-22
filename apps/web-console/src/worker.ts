interface AssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface WebConsoleEnv {
  APP_NAME: string;
  ASSETS: AssetsBinding;
  ENVIRONMENT: string;
}

const worker = {
  async fetch(request: Request, env: WebConsoleEnv): Promise<Response> {
    return env.ASSETS.fetch(request);
  }
};

export default worker;
