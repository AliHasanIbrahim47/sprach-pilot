"use client";

import {
  LEARNING_GOALS,
  type LearningGoal,
  MAX_NATIVE_LANGUAGES,
  NATIVE_LANGUAGE_CODES,
  type NativeLanguage,
  PLACEMENT_LEVELS,
  type PlacementLevel,
  type SettingsProfile,
  type UpdateProfileBody,
} from "@sprachpilot/shared";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";

import { LanguageSelect } from "@/components/language-select";
import { CityPicker } from "@/components/onboarding/city-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { isAppLocale } from "@/i18n/config";
import { searchCities } from "@/lib/onboarding-actions";
import { settingsStatusMessage } from "@/lib/settings-result";

interface ProfileFormProps {
  profile: SettingsProfile;
  onSave: (input: UpdateProfileBody) => Promise<{ ok: boolean }>;
}

/**
 * Edits the same answers onboarding collected, plus display name and timezone.
 */
export function ProfileForm({ profile, onSave }: ProfileFormProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const tOnboarding = useTranslations("Onboarding");
  const locale = useLocale();
  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale],
  );
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [uiLocale, setUiLocale] = useState(isAppLocale(profile.uiLocale) ? profile.uiLocale : "en");
  const [nativeLanguages, setNativeLanguages] = useState<NativeLanguage[]>(profile.nativeLanguages);
  const [cefrLevel, setCefrLevel] = useState<PlacementLevel | null>(profile.cefrLevel);
  const [goals, setGoals] = useState<LearningGoal[]>(profile.goals);
  const [cityId, setCityId] = useState<string | null>(profile.city?.id ?? null);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState({
    displayName: profile.displayName,
    uiLocale: isAppLocale(profile.uiLocale) ? profile.uiLocale : "en",
    nativeLanguages: profile.nativeLanguages,
    cefrLevel: profile.cefrLevel,
    goals: profile.goals,
    cityId: profile.city?.id ?? null,
    timezone: profile.timezone,
  });

  const isDirty =
    displayName !== saved.displayName ||
    uiLocale !== saved.uiLocale ||
    timezone !== saved.timezone ||
    cefrLevel !== saved.cefrLevel ||
    cityId !== saved.cityId ||
    !sameMembers(nativeLanguages, saved.nativeLanguages) ||
    !sameMembers(goals, saved.goals);

  async function persist(): Promise<boolean> {
    if (nativeLanguages.length === 0 || goals.length === 0 || !cefrLevel) {
      setSummary(t("invalidField"));
      return false;
    }
    setIsSaving(true);
    const result = await onSave({
      displayName,
      uiLocale,
      nativeLanguages,
      cefrLevel,
      goals,
      cityId,
      timezone,
    });
    setIsSaving(false);
    setSummary(settingsStatusMessage(result, t("saved"), tErrors));
    if (result.ok) {
      setSaved({
        displayName,
        uiLocale,
        nativeLanguages,
        cefrLevel,
        goals,
        cityId,
        timezone,
      });
    }
    return result.ok;
  }

  function discard(): void {
    setDisplayName(saved.displayName);
    setUiLocale(saved.uiLocale);
    setNativeLanguages(saved.nativeLanguages);
    setCefrLevel(saved.cefrLevel);
    setGoals(saved.goals);
    setCityId(saved.cityId);
    setTimezone(saved.timezone);
    setSummary("");
  }

  useUnsavedChanges("profile", { isDirty, save: persist, discard });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await persist();
  }

  const levelLabel = {
    A1: tOnboarding("levelA1"),
    A2: tOnboarding("levelA2"),
    B1: tOnboarding("levelB1"),
    B2: tOnboarding("levelB2"),
    C1: tOnboarding("levelC1"),
  } as const;

  const goalLabel = {
    work: tOnboarding("goalWork"),
    bureaucracy: tOnboarding("goalBureaucracy"),
    health: tOnboarding("goalHealth"),
    housing: tOnboarding("goalHousing"),
    social: tOnboarding("goalSocial"),
    exam: tOnboarding("goalExam"),
  } as const;

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => void handleSubmit(event)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name">{t("displayName")}</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="nickname"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <span id="ui-language" className="text-sm font-medium">
          {tOnboarding("uiLanguage")}
        </span>
        <LanguageSelect value={uiLocale} labelledBy="ui-language" onChange={setUiLocale} />
      </div>

      <MultiSelect
        id="native-languages"
        label={tOnboarding("nativeLanguages")}
        placeholder={t("chooseLanguages")}
        removeLabel={(name) => t("removeSelection", { label: name })}
        max={MAX_NATIVE_LANGUAGES}
        value={nativeLanguages}
        onChange={setNativeLanguages}
        options={NATIVE_LANGUAGE_CODES.map((code) => ({
          value: code,
          label: languageNames.of(code) ?? code,
        }))}
      />
      <p className="text-muted-foreground text-sm">
        {tOnboarding("nativeLanguagesLimit", { count: MAX_NATIVE_LANGUAGES })}
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("level")}</legend>
        {PLACEMENT_LEVELS.map((level) => (
          <label key={level} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="cefrLevel"
              checked={cefrLevel === level}
              onChange={() => setCefrLevel(level)}
            />
            {levelLabel[level]}
          </label>
        ))}
      </fieldset>

      <MultiSelect
        id="learning-goals"
        label={t("goals")}
        placeholder={t("chooseGoals")}
        removeLabel={(name) => t("removeSelection", { label: name })}
        value={goals}
        onChange={setGoals}
        options={LEARNING_GOALS.map((goal) => ({
          value: goal,
          label: goalLabel[goal],
        }))}
      />

      <CityPicker
        selectedId={cityId}
        onSearch={searchCities}
        onSelect={(city) => setCityId(city.id)}
      />
      {profile.city && cityId === profile.city.id ? (
        <p className="text-muted-foreground text-sm">{profile.city.name}</p>
      ) : null}
      <Button type="button" variant="outline" onClick={() => setCityId(null)}>
        {t("clearCity")}
      </Button>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timezone">{t("timezone")}</Label>
        <Input
          id="timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          autoComplete="off"
          required
        />
      </div>

      {summary ? (
        <p role="status" className="text-sm">
          {summary}
        </p>
      ) : null}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? t("saving") : t("saveProfile")}
      </Button>
    </form>
  );
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(right);
  return left.every((item) => values.has(item));
}
