import type { OnboardingResponse, QuizItem } from "@sprachpilot/shared";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CafeHome } from "@/components/onboarding/cafe-home";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { RecommendedScenarios } from "@/components/onboarding/recommended-scenarios";

import en from "../messages/en.json";

const { routerReplace } = vi.hoisted(() => ({ routerReplace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  usePathname: () => "/onboarding",
}));

afterEach(() => {
  cleanup();
  routerReplace.mockReset();
});

function renderWithMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function pending(step: OnboardingResponse["step"]): OnboardingResponse {
  return {
    status: "pending",
    step,
    uiLocale: "en",
    nativeLanguages: ["en"],
    cefrLevel: step === "languages" ? null : "A1",
    goals: [],
    city: null,
    needsCity: true,
    recommendations: [],
  };
}

const listeningItem: QuizItem = {
  id: "listen-1",
  kind: "listening",
  level: "A2",
  prompt: "Was hören Sie?",
  passage: null,
  transcript: "Der Zug fährt von Gleis 7 ab.",
  choices: [
    { id: "a", text: "Gleis 7" },
    { id: "b", text: "Gleis 1" },
  ],
};

describe("onboarding wizard", () => {
  it("announces the first step to assistive technology", () => {
    renderWithMessages(
      <OnboardingWizard
        initial={pending("languages")}
        quizItems={[]}
        onSave={vi.fn()}
        onScoreQuiz={vi.fn()}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        onSearchCities={vi.fn()}
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Onboarding progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "5");
    expect(progress).toHaveAttribute("aria-valuetext", "Step 1 of 5: Languages");
    expect(screen.getByText("Step 1 of 5: Languages")).toHaveAttribute("aria-live", "polite");
  });

  it("shows a listening transcript and lets the learner override the suggested level", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true, data: pending("goals") });
    const onScoreQuiz = vi.fn().mockResolvedValue({
      ok: true,
      data: { suggestedLevel: "A2", correctCount: 7, itemCount: 10 },
    });

    renderWithMessages(
      <OnboardingWizard
        initial={pending("quiz")}
        quizItems={[listeningItem]}
        onSave={onSave}
        onScoreQuiz={onScoreQuiz}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        onSearchCities={vi.fn()}
      />,
    );

    expect(screen.queryByText("Der Zug fährt von Gleis 7 ab.")).not.toBeInTheDocument();
    const transcriptToggle = screen.getByRole("checkbox", { name: "Show transcript" });
    expect(transcriptToggle).not.toBeChecked();
    await user.click(transcriptToggle);
    expect(screen.getByText("Der Zug fährt von Gleis 7 ab.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play audio" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Gleis 7" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText("7 of 10 correct. We suggest A2. You can change it."),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Use this level"), "B1");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ step: "quiz", skipped: false, cefrLevel: "B1" });
    });
  });

  it("explains that city is optional and stores nothing when the step is skipped", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true, data: pending("city") });
    const onComplete = vi.fn().mockResolvedValue({ ok: true, data: pending("city") });

    renderWithMessages(
      <OnboardingWizard
        initial={pending("city")}
        quizItems={[]}
        onSave={onSave}
        onScoreQuiz={vi.fn()}
        onComplete={onComplete}
        onSkip={vi.fn()}
        onSearchCities={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Used only to find events near you. We store the city and an approximate centre, not your address.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ step: "city", skipped: true, cityId: null });
      expect(onComplete).toHaveBeenCalledOnce();
      expect(routerReplace).toHaveBeenCalledWith("/dashboard");
    });
  });
});

describe("café without a city", () => {
  it("asks for a city when the location step was skipped", () => {
    renderWithMessages(<CafeHome needsCity cityName={null} onSearch={vi.fn()} onSave={vi.fn()} />);

    expect(
      screen.getByText("Add your city to find Sprachcafé events near you."),
    ).toBeInTheDocument();
    expect(screen.getByText(/approximate centre/)).toBeInTheDocument();
  });

  it("does not ask again once a city is saved", () => {
    renderWithMessages(
      <CafeHome needsCity={false} cityName="Berlin" onSearch={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.getByText("Events near Berlin.")).toBeInTheDocument();
    expect(
      screen.queryByText("Add your city to find Sprachcafé events near you."),
    ).not.toBeInTheDocument();
  });
});

describe("recommended scenarios", () => {
  it("shows the housing scenario returned for that goal", () => {
    renderWithMessages(
      <RecommendedScenarios
        title="Recommended for you"
        scenarios={[
          {
            id: "housing-viewing",
            level: "A2",
            goals: ["housing"],
            title: "Wohnungsbesichtigung",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();
    expect(screen.getByText("Wohnungsbesichtigung")).toHaveAttribute("lang", "de");
  });
});
