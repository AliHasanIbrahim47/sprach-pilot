import { Prisma } from "@sprachpilot/db";
import { type AppError, ConflictError, NotFoundError } from "@sprachpilot/shared";

/**
 * Map Prisma known request errors to domain errors (SP-009 FR-3).
 * Returns null when the error is not a mappable Prisma error.
 */
export function mapPrismaError(error: unknown): AppError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code === "P2002") {
    const target = formatUniqueTarget(error.meta?.["target"]);
    return new ConflictError(
      target ? `A record with this ${target} already exists` : "Unique constraint violated",
      { cause: error },
    );
  }

  if (error.code === "P2025") {
    return new NotFoundError("Record not found", { cause: error });
  }

  return null;
}

function formatUniqueTarget(target: unknown): string | undefined {
  if (typeof target === "string" && target.length > 0) return target;
  if (Array.isArray(target) && target.every((part) => typeof part === "string")) {
    return target.join(", ");
  }
  return undefined;
}
