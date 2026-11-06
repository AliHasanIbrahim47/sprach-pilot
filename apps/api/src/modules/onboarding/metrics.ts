const STEPS = ["languages", "level", "quiz", "goals", "city", "skipped"] as const;

export type OnboardingMetricStep = (typeof STEPS)[number];

export interface OnboardingMetrics {
  recordStep(step: OnboardingMetricStep): void;
  renderPrometheus(): string;
}

export function createOnboardingMetrics(): OnboardingMetrics {
  const counts = new Map<OnboardingMetricStep, number>(STEPS.map((step) => [step, 0]));

  return {
    /**
     * Increments the funnel counter for one onboarding step.
     */
    recordStep(step) {
      counts.set(step, (counts.get(step) ?? 0) + 1);
    },
    /**
     * Renders the onboarding funnel as a Prometheus counter labeled by step.
     */
    renderPrometheus() {
      const lines = [
        "# HELP onboarding_step_completed_total Onboarding funnel events by step",
        "# TYPE onboarding_step_completed_total counter",
      ];
      for (const [step, count] of counts) {
        lines.push(`onboarding_step_completed_total{step="${step}"} ${count}`);
      }
      lines.push("");
      return lines.join("\n");
    },
  };
}
