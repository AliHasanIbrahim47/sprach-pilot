import type { Scenario } from "@sprachpilot/shared";

interface RecommendedScenariosProps {
  title: string;
  scenarios: readonly Scenario[];
}

export function RecommendedScenarios({
  title,
  scenarios,
}: RecommendedScenariosProps): React.JSX.Element | null {
  if (scenarios.length === 0) return null;

  return (
    <section className="mt-8 flex flex-col gap-3" aria-labelledby="recommended-scenarios">
      <h2 id="recommended-scenarios" className="font-display text-2xl tracking-tight">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {scenarios.map((scenario) => (
          <li key={scenario.id} lang="de" className="border-border rounded-md border px-3 py-2">
            {scenario.title}
          </li>
        ))}
      </ul>
    </section>
  );
}
