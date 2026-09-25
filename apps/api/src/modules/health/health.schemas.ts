export type DependencyName = "database" | "redis";

export type CheckStatus = "ok" | "fail";

export interface LivenessResponse {
  status: "ok";
}

export interface ReadinessResponse {
  status: "ok" | "not_ready";
  checks: Record<DependencyName, CheckStatus>;
  failing: DependencyName[];
}

export interface DependencyHealthPort {
  readonly name: DependencyName;
  check(): Promise<boolean>;
}
