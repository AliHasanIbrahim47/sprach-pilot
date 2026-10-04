const LOGIN_RESULTS = ["success", "failure", "locked"] as const;
const REGISTER_RESULTS = ["created", "duplicate", "rejected", "disabled"] as const;
const REFRESH_RESULTS = ["success", "invalid", "expired", "reuse"] as const;

export type LoginMetricResult = (typeof LOGIN_RESULTS)[number];
export type RegisterMetricResult = (typeof REGISTER_RESULTS)[number];
export type RefreshMetricResult = (typeof REFRESH_RESULTS)[number];

export interface AuthMetrics {
  recordLogin(result: LoginMetricResult): void;
  recordRegister(result: RegisterMetricResult): void;
  recordRefresh(result: RefreshMetricResult): void;
  recordTokenReuse(): void;
  renderPrometheus(): string;
}

export function createAuthMetrics(): AuthMetrics {
  const logins = new Map<LoginMetricResult, number>(LOGIN_RESULTS.map((result) => [result, 0]));
  const registers = new Map<RegisterMetricResult, number>(
    REGISTER_RESULTS.map((result) => [result, 0]),
  );
  const refreshes = new Map<RefreshMetricResult, number>(
    REFRESH_RESULTS.map((result) => [result, 0]),
  );
  let tokenReuse = 0;

  function renderCounter(
    name: string,
    help: string,
    values: ReadonlyMap<string, number>,
  ): string[] {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
    for (const [result, count] of values) {
      lines.push(`${name}{result="${result}"} ${count}`);
    }
    return lines;
  }

  return {
    recordLogin(result) {
      logins.set(result, (logins.get(result) ?? 0) + 1);
    },
    recordRegister(result) {
      registers.set(result, (registers.get(result) ?? 0) + 1);
    },
    recordRefresh(result) {
      refreshes.set(result, (refreshes.get(result) ?? 0) + 1);
    },
    recordTokenReuse() {
      tokenReuse += 1;
    },
    renderPrometheus() {
      return [
        ...renderCounter("auth_login_total", "Login attempts by result", logins),
        ...renderCounter("auth_register_total", "Registration attempts by result", registers),
        ...renderCounter("auth_refresh_total", "Refresh attempts by result", refreshes),
        "# HELP auth_token_reuse_detected_total Refresh tokens presented after rotation",
        "# TYPE auth_token_reuse_detected_total counter",
        `auth_token_reuse_detected_total ${tokenReuse}`,
        "",
      ].join("\n");
    },
  };
}
