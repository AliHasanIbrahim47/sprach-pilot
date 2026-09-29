import { z } from "zod";

export const dependencyNameSchema = z.enum(["database", "redis"]).meta({
  id: "DependencyName",
});

export type DependencyName = z.infer<typeof dependencyNameSchema>;

export const checkStatusSchema = z.enum(["ok", "fail"]).meta({ id: "CheckStatus" });

export type CheckStatus = z.infer<typeof checkStatusSchema>;

export const livenessResponseSchema = z
  .object({
    status: z.literal("ok"),
  })
  .meta({ id: "LivenessResponse" });

export type LivenessResponse = z.infer<typeof livenessResponseSchema>;

export const readinessResponseSchema = z
  .object({
    status: z.enum(["ok", "not_ready"]),
    checks: z.record(dependencyNameSchema, checkStatusSchema),
    failing: z.array(dependencyNameSchema),
  })
  .meta({ id: "ReadinessResponse" });

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
