"use client";

import {
  type CitySuggestion,
  LEARNING_GOALS,
  type LearningGoal,
  NATIVE_LANGUAGE_CODES,
  type NativeLanguage,
  ONBOARDING_STEPS,
  type OnboardingResponse,
  type OnboardingStep,
  type OnboardingStepBody,
  PLACEMENT_LEVELS,
  type PlacementLevel,
  type QuizItem,
  type QuizResult,
  type QuizSubmission,
} from "@sprachpilot/shared";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { LanguageSelect } from "@/components/language-select";
import { CityPicker } from "@/components/onboarding/city-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type AppLocale, isAppLocale } from "@/i18n/config";
import { useRouter } from "@/i18n/navigation";
import type { OnboardingActionResult } from "@/lib/onboarding-result";

const STEP_LABEL = {
  languages: "stepLanguages",
  level: "stepLevel",
  quiz: "stepQuiz",
  goals: "stepGoals",
  city: "stepCity",
} as const;

const LEVEL_COPY = {
  A1: ["levelA1", "levelA1Body"],
  A2: ["levelA2", "levelA2Body"],
  B1: ["levelB1", "levelB1Body"],
  B2: ["levelB2", "levelB2Body"],
  C1: ["levelC1", "levelC1Body"],
} as const;

const GOAL_LABEL = {
  work: "goalWork",
  bureaucracy: "goalBureaucracy",
  health: "goalHealth",
  housing: "goalHousing",
  social: "goalSocial",
  exam: "goalExam",
} as const;

interface OnboardingWizardProps {
  initial: OnboardingResponse;
  quizItems: readonly QuizItem[];
  onSave: (body: OnboardingStepBody) => Promise<OnboardingActionResult<OnboardingResponse>>;
  onScoreQuiz: (body: QuizSubmission) => Promise<OnboardingActionResult<QuizResult>>;
  onComplete: () => Promise<OnboardingActionResult<OnboardingResponse>>;
  onSkip: () => Promise<OnboardingActionResult<OnboardingResponse>>;
  onSearchCities: (query: string) => Promise<CitySuggestion[]>;
}

/**
 * Five-step wizard. The server keeps the resume point, and Back moves only this screen.
 */
export function OnboardingWizard({
  initial,
  quizItems,
  onSave,
  onScoreQuiz,
  onComplete,
  onSkip,
  onSearchCities,
}: OnboardingWizardProps): React.JSX.Element {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale],
  );

  const [view, setView] = useState<OnboardingStep>(initial.step);
  const [uiLocale, setUiLocale] = useState<AppLocale>(
    isAppLocale(initial.uiLocale) ? initial.uiLocale : "en",
  );
  const [nativeLanguages, setNativeLanguages] = useState<NativeLanguage[]>(initial.nativeLanguages);
  const [cefrLevel, setCefrLevel] = useState<PlacementLevel>(initial.cefrLevel ?? "A1");
  const [goals, setGoals] = useState<LearningGoal[]>(initial.goals);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [overrideLevel, setOverrideLevel] = useState<PlacementLevel>(initial.cefrLevel ?? "A2");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [view]);

  const stepIndex = ONBOARDING_STEPS.indexOf(view);
  const announcement = t("stepAnnouncement", {
    current: stepIndex + 1,
    total: ONBOARDING_STEPS.length,
    step: t(STEP_LABEL[view]),
  });

  /**
   * Saves one step and shows the next one. A new app language also switches the page locale.
   */
  async function persist(body: OnboardingStepBody): Promise<boolean> {
    setError("");
    setIsBusy(true);
    try {
      const result = await onSave(body);
      if (!result.ok) {
        setError(t("saveError"));
        return false;
      }
      const index = ONBOARDING_STEPS.indexOf(body.step);
      const next = ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)] ?? body.step;
      setView(next);
      if (body.step === "languages" && body.uiLocale !== locale) {
        router.replace("/onboarding", { locale: body.uiLocale });
      }
      return true;
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Saves the city step, completes onboarding, and opens the dashboard.
   */
  async function finish(body: OnboardingStepBody): Promise<void> {
    const saved = await persist(body);
    if (!saved) return;
    setIsBusy(true);
    try {
      const result = await onComplete();
      if (!result.ok) {
        setError(t("saveError"));
        return;
      }
      router.replace("/dashboard");
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Closes the wizard and opens the dashboard.
   */
  async function handleSkip(): Promise<void> {
    setError("");
    setIsBusy(true);
    try {
      const result = await onSkip();
      if (!result.ok) {
        setError(t("saveError"));
        return;
      }
      router.replace("/dashboard");
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Shows the previous step without writing to the server.
   */
  function handleBack(): void {
    const previous = ONBOARDING_STEPS[stepIndex - 1];
    if (previous) setView(previous);
  }

  /**
   * Requires one native language, then saves the app language and those languages.
   */
  async function handleLanguages(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (nativeLanguages.length === 0) {
      setError(t("chooseLanguage"));
      return;
    }
    await persist({ step: "languages", uiLocale, nativeLanguages });
  }

  async function handleLevel(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await persist({ step: "level", cefrLevel });
  }

  /**
   * Scores the quiz, then saves the suggested level or the level the learner chose instead.
   */
  async function handleQuiz(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (quizResult) {
      await persist({ step: "quiz", skipped: false, cefrLevel: overrideLevel });
      return;
    }
    if (quizItems.some((item) => !answers[item.id])) {
      setError(t("answerAll"));
      return;
    }
    setError("");
    setIsBusy(true);
    try {
      const result = await onScoreQuiz({
        answers: quizItems.map((item) => ({
          itemId: item.id,
          choiceId: answers[item.id] ?? "",
        })),
      });
      if (!result.ok) {
        setError(t("saveError"));
        return;
      }
      setQuizResult(result.data);
      setOverrideLevel(result.data.suggestedLevel);
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Requires one goal, then saves the selection.
   */
  async function handleGoals(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (goals.length === 0) {
      setError(t("chooseGoal"));
      return;
    }
    await persist({ step: "goals", goals });
  }

  /**
   * Saves the chosen city and finishes onboarding.
   */
  async function handleCity(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedCity) {
      setError(t("chooseCity"));
      return;
    }
    await finish({ step: "city", skipped: false, cityId: selectedCity.id });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div
        role="progressbar"
        aria-label={t("progressLabel")}
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_STEPS.length}
        aria-valuenow={stepIndex + 1}
        aria-valuetext={announcement}
        className="bg-muted h-2 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full"
          style={{ width: `${((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>

      {view === "languages" ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleLanguages(event)}>
          <StepHeading
            headingRef={headingRef}
            title={t("languagesTitle")}
            body={t("languagesBody")}
          />
          <div className="flex flex-col gap-1.5">
            <Label id="ui-locale-label" htmlFor="ui-locale">
              {t("uiLanguage")}
            </Label>
            <LanguageSelect
              id="ui-locale"
              labelledBy="ui-locale-label"
              className="w-full"
              value={uiLocale}
              onChange={setUiLocale}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("nativeLanguages")}</legend>
            {NATIVE_LANGUAGE_CODES.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="nativeLanguages"
                  value={code}
                  checked={nativeLanguages.includes(code)}
                  onChange={() => {
                    setNativeLanguages((current) =>
                      current.includes(code)
                        ? current.filter((item) => item !== code)
                        : [...current, code],
                    );
                  }}
                />
                {languageNames.of(code) ?? code}
              </label>
            ))}
          </fieldset>
          <WizardActions
            isBusy={isBusy}
            onSkip={() => {
              void handleSkip();
            }}
            {...(stepIndex > 0 ? { onBack: handleBack } : {})}
          />
        </form>
      ) : null}

      {view === "level" ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleLevel(event)}>
          <StepHeading headingRef={headingRef} title={t("levelTitle")} body={t("levelBody")} />
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{t("levelTitle")}</legend>
            {PLACEMENT_LEVELS.map((level) => (
              <label
                key={level}
                className="border-input flex flex-col gap-1 rounded-md border p-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="cefrLevel"
                    value={level}
                    checked={cefrLevel === level}
                    onChange={() => setCefrLevel(level)}
                  />
                  {t(LEVEL_COPY[level][0])}
                </span>
                <span className="text-muted-foreground ps-6">{t(LEVEL_COPY[level][1])}</span>
              </label>
            ))}
          </fieldset>
          <WizardActions isBusy={isBusy} onBack={handleBack} onSkip={() => void handleSkip()} />
        </form>
      ) : null}

      {view === "quiz" ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleQuiz(event)}>
          <StepHeading headingRef={headingRef} title={t("quizTitle")} body={t("quizBody")} />
          {quizItems.map((item, index) => (
            <fieldset key={item.id} className="flex flex-col gap-2" lang="de">
              <legend className="text-sm font-medium">
                {index + 1}. {item.prompt}
              </legend>
              {item.passage ? <p className="text-sm">{item.passage}</p> : null}
              {item.transcript ? (
                <ListeningClip itemId={item.id} transcript={item.transcript} />
              ) : null}
              {item.choices.map((choice) => (
                <label key={choice.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={item.id}
                    value={choice.id}
                    checked={answers[item.id] === choice.id}
                    onChange={() => {
                      setAnswers((current) => ({ ...current, [item.id]: choice.id }));
                    }}
                  />
                  {choice.text}
                </label>
              ))}
            </fieldset>
          ))}
          {quizResult ? (
            <div className="flex flex-col gap-2">
              <p>
                {t("quizScore", {
                  correct: quizResult.correctCount,
                  total: quizResult.itemCount,
                  level: quizResult.suggestedLevel,
                })}
              </p>
              <Label htmlFor="override-level">{t("overrideLevel")}</Label>
              <select
                id="override-level"
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                value={overrideLevel}
                onChange={(event) => {
                  if (isPlacementLevel(event.target.value)) setOverrideLevel(event.target.value);
                }}
              >
                {PLACEMENT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => void persist({ step: "quiz", skipped: true, cefrLevel: null })}
            >
              {t("quizSkip")}
            </Button>
          )}
          <WizardActions isBusy={isBusy} onBack={handleBack} onSkip={() => void handleSkip()} />
        </form>
      ) : null}

      {view === "goals" ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleGoals(event)}>
          <StepHeading headingRef={headingRef} title={t("goalsTitle")} body={t("goalsBody")} />
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("goalsTitle")}</legend>
            {LEARNING_GOALS.map((goal) => (
              <label key={goal} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="goals"
                  value={goal}
                  checked={goals.includes(goal)}
                  onChange={() => {
                    setGoals((current) =>
                      current.includes(goal)
                        ? current.filter((item) => item !== goal)
                        : [...current, goal],
                    );
                  }}
                />
                {t(GOAL_LABEL[goal])}
              </label>
            ))}
          </fieldset>
          <WizardActions isBusy={isBusy} onBack={handleBack} onSkip={() => void handleSkip()} />
        </form>
      ) : null}

      {view === "city" ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleCity(event)}>
          <StepHeading headingRef={headingRef} title={t("cityTitle")} body={t("cityBody")} />
          <p className="text-muted-foreground text-sm">{t("cityPrivacy")}</p>
          <CityPicker
            selectedId={selectedCity?.id ?? null}
            onSearch={onSearchCities}
            onSelect={setSelectedCity}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => void finish({ step: "city", skipped: true, cityId: null })}
          >
            {t("citySkip")}
          </Button>
          <WizardActions
            isBusy={isBusy}
            onBack={handleBack}
            onSkip={() => void handleSkip()}
            continueLabel={t("finish")}
          />
        </form>
      ) : null}
    </div>
  );
}

function StepHeading({
  headingRef,
  title,
  body,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-3xl tracking-tight outline-none"
      >
        {title}
      </h1>
      <p className="text-muted-foreground text-sm">{body}</p>
    </div>
  );
}

/**
 * Back, continue, and skip controls for the current step.
 */
function WizardActions({
  isBusy,
  onBack,
  onSkip,
  continueLabel,
}: {
  isBusy: boolean;
  onBack?: () => void;
  onSkip: () => void;
  continueLabel?: string;
}): React.JSX.Element {
  const t = useTranslations("Onboarding");
  return (
    <div className="flex flex-wrap gap-2">
      {onBack ? (
        <Button type="button" variant="outline" disabled={isBusy} onClick={onBack}>
          {t("back")}
        </Button>
      ) : null}
      <Button type="submit" disabled={isBusy}>
        {isBusy ? t("saving") : (continueLabel ?? t("continue"))}
      </Button>
      <Button type="button" variant="ghost" disabled={isBusy} onClick={onSkip}>
        {t("skipWizard")}
      </Button>
    </div>
  );
}

/**
 * Plays the question audio and reveals the German transcript only when asked.
 */
function ListeningClip({
  itemId,
  transcript,
}: {
  itemId: string;
  transcript: string;
}): React.JSX.Element {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasPlayError, setHasPlayError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  /**
   * Restarts this question's clip and reports a failure without submitting the form.
   */
  function handlePlay(): void {
    setHasPlayError(false);
    const audio = audioRef.current ?? new Audio(`/quiz/${itemId}.mp3`);
    audioRef.current = audio;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      setHasPlayError(true);
    });
  }

  return (
    <div lang={locale} className="bg-muted flex flex-col gap-2 rounded-md p-3 text-sm">
      <Button type="button" variant="outline" onClick={handlePlay}>
        {t("playAudio")}
      </Button>
      {hasPlayError ? (
        <p role="alert" className="text-destructive">
          {t("audioError")}
        </p>
      ) : null}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showTranscript}
          onChange={(event) => setShowTranscript(event.target.checked)}
        />
        {t("showTranscript")}
      </label>
      {showTranscript ? <p lang="de">{transcript}</p> : null}
    </div>
  );
}

function isPlacementLevel(value: string): value is PlacementLevel {
  return (PLACEMENT_LEVELS as readonly string[]).includes(value);
}
