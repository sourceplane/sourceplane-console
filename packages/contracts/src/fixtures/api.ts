import type { ApiErrorEnvelope, ApiSuccessEnvelope } from "../api/index.js";

export const validApiSuccessFixture: ApiSuccessEnvelope<{ groups: string[] }> = {
  data: {
    groups: ["/v1/projects", "/v1/resources"]
  },
  meta: {
    cursor: null,
    requestId: "req_fixture_api_success"
  }
};

export const validApiErrorFixture: ApiErrorEnvelope = {
  error: {
    code: "forbidden",
    details: {
      orgId: "org_123"
    },
    message: "You do not have access to this organization.",
    requestId: "req_fixture_api_error"
  }
};

export const invalidApiSuccessFixture = {
  data: {
    groups: []
  },
  meta: {
    cursor: null
  }
};

export const invalidApiErrorFixture = {
  error: {
    code: "nope",
    details: {},
    message: "This should fail.",
    requestId: "req_fixture_api_error"
  }
};