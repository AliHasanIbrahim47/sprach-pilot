import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, defaultTimeZone, isAppLocale } from "./config";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && hasLocale(routing.locales, requested) && isAppLocale(requested)
      ? requested
      : defaultLocale;

  return {
    locale,
    timeZone: defaultTimeZone,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
