import type { DependencyHealthPort } from "./health.schemas.js";

export interface HealthRepository {
  checkDependencies(): Promise<Array<{ name: DependencyHealthPort["name"]; ok: boolean }>>;
}

export function createHealthRepository(dependencies: DependencyHealthPort[]): HealthRepository {
  return {
    async checkDependencies() {
      return Promise.all(
        dependencies.map(async (dependency) => ({
          name: dependency.name,
          ok: await dependency.check(),
        })),
      );
    },
  };
}
