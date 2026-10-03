import { createFormatter } from "next-intl";

import { defaultTimeZone } from "@/i18n/config";

/** Shared date/number formatting defaults (Europe/Berlin). */
export function createAppFormatter(locale: string) {
  return createFormatter({ locale, timeZone: defaultTimeZone });
}
