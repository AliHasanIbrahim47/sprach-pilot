import type { DependencyName } from "@sprachpilot/shared";

export type {
  CheckStatus,
  DependencyName,
  LivenessResponse,
  ReadinessResponse,
} from "@sprachpilot/shared";

export interface DependencyHealthPort {
  readonly name: DependencyName;
  check(): Promise<boolean>;
}
