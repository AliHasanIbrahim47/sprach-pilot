import { ERROR_TYPE_BASE } from "./constants.js";
import {
  type FieldError,
  type ProblemContext,
  type ProblemDetails,
  toProblemDetails,
} from "./problem-details.js";

export type AppErrorCode =
  | "validation"
  | "not-found"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "external-service"
  | "internal";

export type AppErrorOptions = {
  detail?: string;
  errors?: FieldError[];
  /** When false, detail is omitted from client responses (still logged). Default true for 4xx. */
  exposeDetail?: boolean;
  cause?: unknown;
};

/**
 * Base domain error. Throw from services/controllers; the API error middleware
 * maps these to RFC 9457 Problem Details.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;
  readonly exposeDetail: boolean;

  constructor(code: AppErrorCode, status: number, title: string, options: AppErrorOptions = {}) {
    super(
      options.detail ?? title,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.title = title;
    this.detail = options.detail;
    this.errors = options.errors;
    this.exposeDetail = options.exposeDetail ?? status < 500;
  }

  get type(): string {
    return `${ERROR_TYPE_BASE}/${this.code}`;
  }

  toProblemDetails(context: ProblemContext): ProblemDetails {
    return toProblemDetails(
      {
        type: this.type,
        title: this.title,
        status: this.status,
        exposeDetail: this.exposeDetail,
        ...(this.detail !== undefined ? { detail: this.detail } : {}),
        ...(this.errors !== undefined ? { errors: this.errors } : {}),
      },
      context,
    );
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export class ValidationError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super("validation", 400, "Validation failed", {
      detail: options.detail ?? "One or more fields are invalid",
      ...(options.errors !== undefined ? { errors: options.errors } : {}),
      ...(options.exposeDetail !== undefined ? { exposeDetail: options.exposeDetail } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(detail = "Resource not found", options: Omit<AppErrorOptions, "detail"> = {}) {
    super("not-found", 404, "Not Found", {
      detail,
      ...(options.errors !== undefined ? { errors: options.errors } : {}),
      ...(options.exposeDetail !== undefined ? { exposeDetail: options.exposeDetail } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(detail = "Resource conflict", options: Omit<AppErrorOptions, "detail"> = {}) {
    super("conflict", 409, "Conflict", {
      detail,
      ...(options.errors !== undefined ? { errors: options.errors } : {}),
      ...(options.exposeDetail !== undefined ? { exposeDetail: options.exposeDetail } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = "Authentication required", options: Omit<AppErrorOptions, "detail"> = {}) {
    super("unauthorized", 401, "Unauthorized", {
      detail,
      ...(options.errors !== undefined ? { errors: options.errors } : {}),
      ...(options.exposeDetail !== undefined ? { exposeDetail: options.exposeDetail } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = "Insufficient permissions", options: Omit<AppErrorOptions, "detail"> = {}) {
    super("forbidden", 403, "Forbidden", {
      detail,
      ...(options.errors !== undefined ? { errors: options.errors } : {}),
      ...(options.exposeDetail !== undefined ? { exposeDetail: options.exposeDetail } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "ForbiddenError";
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number | undefined;

  constructor(
    detail = "Too many requests",
    options: Omit<AppErrorOptions, "detail"> & { retryAfterSeconds?: number } = {},
  ) {
    const { retryAfterSeconds, ...rest } = options;
    super("rate-limited", 429, "Too Many Requests", {
      detail,
      ...(rest.errors !== undefined ? { errors: rest.errors } : {}),
      ...(rest.exposeDetail !== undefined ? { exposeDetail: rest.exposeDetail } : {}),
      ...(rest.cause !== undefined ? { cause: rest.cause } : {}),
    });
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    detail = "An upstream service failed",
    options: Omit<AppErrorOptions, "detail"> = {},
  ) {
    super("external-service", 502, "Bad Gateway", {
      detail,
      exposeDetail: options.exposeDetail ?? false,
      ...(options.errors !== undefined ? { errors: options.errors } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "ExternalServiceError";
  }
}
