"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { UnsavedStepScope, useConfirmLeave } from "@/components/unsaved-changes";
import { cn } from "@/lib/utils";

export interface SettingsStep {
  id: string;
  title: string;
  content: ReactNode;
}

interface SettingsStepperProps {
  steps: readonly SettingsStep[];
}

let rememberedStep: number | null = null;

/** Drops a step remembered for the settings page refresh. Tests call this between cases. */
export function clearRememberedSettingsStep(): void {
  rememberedStep = null;
}

/**
 * Shows one settings section at a time. Other sections stay mounted so unsaved edits survive Back.
 */
export function SettingsStepper({ steps }: SettingsStepperProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const confirmLeave = useConfirmLeave();
  const [current, setCurrent] = useState(0);
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;

  useEffect(() => {
    if (rememberedStep === null || rememberedStep === current || rememberedStep >= steps.length) {
      return;
    }
    setCurrent(rememberedStep);
  }, [current, steps.length]);

  useEffect(() => {
    return () => {
      const step = rememberedStep;
      window.setTimeout(() => {
        if (rememberedStep === step) rememberedStep = null;
      }, 5000);
    };
  }, []);

  function show(index: number): void {
    rememberedStep = index;
    setCurrent(index);
  }

  async function goTo(index: number): Promise<void> {
    if (index === current) return;
    const allowed = await confirmLeave(() => show(index), steps[current]?.id);
    if (allowed) show(index);
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("title")}>
        <p className="text-muted-foreground mb-3 text-sm">
          {t("stepProgress", { current: current + 1, total: steps.length })}
        </p>
        <ol className="flex flex-wrap gap-2">
          {steps.map((item, index) => {
            const isCurrent = index === current;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent",
                  )}
                  onClick={() => void goTo(index)}
                >
                  {item.title}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {steps.map((item, index) => (
        <section key={item.id} hidden={index !== current} className="flex flex-col gap-4">
          <h2 className="text-xl font-medium">{item.title}</h2>
          <UnsavedStepScope id={item.id}>{item.content}</UnsavedStepScope>
        </section>
      ))}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isFirst}
          onClick={() => void goTo(Math.max(0, current - 1))}
        >
          {t("previousStep")}
        </Button>
        {isLast ? null : (
          <Button type="button" onClick={() => void goTo(Math.min(steps.length - 1, current + 1))}>
            {t("nextStep")}
          </Button>
        )}
      </div>
    </div>
  );
}
