export interface SettingsMetrics {
  recordSave(durationMs: number): void;
  renderPrometheus(): string;
}

/**
 * Histogram of settings writes. The 300 ms bucket is the ticket's p95 budget.
 */
export function createSettingsMetrics(): SettingsMetrics {
  let within50 = 0;
  let within100 = 0;
  let within300 = 0;
  let within1000 = 0;
  let overflow = 0;
  let sum = 0;

  return {
    recordSave(durationMs) {
      sum += durationMs;
      if (durationMs <= 50) within50 += 1;
      else if (durationMs <= 100) within100 += 1;
      else if (durationMs <= 300) within300 += 1;
      else if (durationMs <= 1_000) within1000 += 1;
      else overflow += 1;
    },
    renderPrometheus() {
      const le50 = within50;
      const le100 = le50 + within100;
      const le300 = le100 + within300;
      const le1000 = le300 + within1000;
      const total = le1000 + overflow;
      return [
        "# HELP settings_save_duration_ms Settings write duration",
        "# TYPE settings_save_duration_ms histogram",
        `settings_save_duration_ms_bucket{le="50"} ${le50}`,
        `settings_save_duration_ms_bucket{le="100"} ${le100}`,
        `settings_save_duration_ms_bucket{le="300"} ${le300}`,
        `settings_save_duration_ms_bucket{le="1000"} ${le1000}`,
        `settings_save_duration_ms_bucket{le="+Inf"} ${total}`,
        `settings_save_duration_ms_sum ${sum}`,
        `settings_save_duration_ms_count ${total}`,
        "",
      ].join("\n");
    },
  };
}
