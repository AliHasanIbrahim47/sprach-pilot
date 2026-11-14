export type DeletionStage = "requested" | "cancelled" | "purged" | "overdue";

export interface PrivacyMetrics {
  recordExport(): void;
  recordDeletion(stage: DeletionStage): void;
  renderPrometheus(): string;
}

export function createPrivacyMetrics(): PrivacyMetrics {
  let exports = 0;
  let requested = 0;
  let cancelled = 0;
  let purged = 0;
  let overdue = 0;

  return {
    recordExport() {
      exports += 1;
    },
    recordDeletion(stage) {
      if (stage === "requested") requested += 1;
      else if (stage === "cancelled") cancelled += 1;
      else if (stage === "purged") purged += 1;
      else overdue += 1;
    },
    renderPrometheus() {
      const deletion = [
        `gdpr_deletion_total{stage="requested"} ${requested}`,
        `gdpr_deletion_total{stage="cancelled"} ${cancelled}`,
        `gdpr_deletion_total{stage="purged"} ${purged}`,
        `gdpr_deletion_total{stage="overdue"} ${overdue}`,
      ].join("\n");
      return [
        "# HELP gdpr_export_total GDPR data exports requested",
        "# TYPE gdpr_export_total counter",
        `gdpr_export_total ${exports}`,
        "# HELP gdpr_deletion_total GDPR account deletions by stage",
        "# TYPE gdpr_deletion_total counter",
        deletion,
        "",
      ].join("\n");
    },
  };
}
