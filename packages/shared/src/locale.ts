import { z } from "zod";

/** UI languages shared by the web app and outbound email (SP-010 / SP-014). */
export const UI_LOCALES = ["en", "de", "ar", "uk", "tr"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const uiLocaleSchema = z.enum(UI_LOCALES);

export function isUiLocale(value: string): value is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(value);
}
