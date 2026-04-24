import type { DeploymentEnvironment, LoginDelivery } from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";

import type { IdentityWorkerEnv } from "../env.js";

export interface LoginCodeDeliveryInput {
  challengeId: string;
  code: string;
  email: string;
  expiresAt: string;
}

export interface LoginCodeDelivery {
  send(input: LoginCodeDeliveryInput): Promise<LoginDelivery>;
}

export function createLoginCodeDelivery(
  env: IdentityWorkerEnv,
  stage: DeploymentEnvironment
): LoginCodeDelivery {
  if (shouldUseDebugDelivery(env, stage)) {
    return {
      send(input: LoginCodeDeliveryInput): Promise<LoginDelivery> {
        return Promise.resolve({
          code: input.code,
          emailHint: maskEmail(input.email),
          mode: "local_debug"
        });
      }
    };
  }

  return {
    async send(input: LoginCodeDeliveryInput): Promise<LoginDelivery> {
      if (!hasConfiguredEmailProvider(env)) {
        throw new SourceplaneHttpError(
          501,
          "unsupported",
          "Identity email delivery is not configured for this environment."
        );
      }

      const response = await fetch(env.AUTH_EMAIL_API_URL, {
        body: JSON.stringify({
          from: env.AUTH_EMAIL_FROM,
          subject: "Your Sourceplane sign-in code",
          text: `Your Sourceplane sign-in code is ${input.code}. It expires at ${input.expiresAt}. Challenge: ${input.challengeId}.`,
          to: input.email
        }),
        headers: {
          authorization: `Bearer ${env.AUTH_EMAIL_API_TOKEN}`,
          "content-type": "application/json; charset=utf-8"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new SourceplaneHttpError(502, "internal_error", "Identity could not deliver the login code.");
      }

      return {
        emailHint: maskEmail(input.email),
        mode: "email"
      };
    }
  };
}

function shouldUseDebugDelivery(env: IdentityWorkerEnv, stage: DeploymentEnvironment): boolean {
  return env.AUTH_LOGIN_DELIVERY_MODE === "local_debug" || (stage === "local" && !hasConfiguredEmailProvider(env));
}

function hasConfiguredEmailProvider(
  env: IdentityWorkerEnv
): env is IdentityWorkerEnv & {
  AUTH_EMAIL_API_TOKEN: string;
  AUTH_EMAIL_API_URL: string;
  AUTH_EMAIL_FROM: string;
} {
  return Boolean(env.AUTH_EMAIL_API_TOKEN && env.AUTH_EMAIL_API_URL && env.AUTH_EMAIL_FROM);
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "***";
  }

  return `${localPart.slice(0, 1) || "*"}***@${domain}`;
}
