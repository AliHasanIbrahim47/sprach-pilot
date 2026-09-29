import { registerBodySchema } from "@sprachpilot/shared";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";

import { validateBody } from "./validate.js";

function mockRes() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  let contentType: string | undefined;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    type(value: string) {
      contentType = value;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
  };

  return {
    res: res as unknown as Response,
    get result() {
      return { statusCode, body, contentType };
    },
  };
}

describe("validateBody unit", () => {
  it("calls next with parsed body on success", () => {
    const middleware = validateBody(registerBodySchema);
    const req = {
      body: {
        email: "  Learner@Example.com ",
        password: "ChangeMe!Learner1",
        displayName: "Demo",
        acceptedTerms: true,
        ignored: true,
      },
      originalUrl: "/v1/auth/register",
    } as unknown as Request;
    const { res } = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    middleware(req, res, next);

    expect(nextCalled).toBe(true);
    expect(req.body).toEqual({
      email: "learner@example.com",
      password: "ChangeMe!Learner1",
      displayName: "Demo",
      acceptedTerms: true,
    });
  });

  it("responds with field errors when validation fails", () => {
    const middleware = validateBody(registerBodySchema);
    const req = {
      body: { email: "bad" },
      originalUrl: "/v1/auth/register",
    } as unknown as Request;
    const mocked = mockRes();
    mocked.res.setHeader("x-request-id", "req-1");
    let nextCalled = false;

    middleware(req, mocked.res, (() => {
      nextCalled = true;
    }) as NextFunction);

    expect(nextCalled).toBe(false);
    expect(mocked.result.statusCode).toBe(400);
    expect(mocked.result.contentType).toBe("application/problem+json");
    expect(mocked.result.body).toMatchObject({
      status: 400,
      requestId: "req-1",
      errors: expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    });
  });
});
