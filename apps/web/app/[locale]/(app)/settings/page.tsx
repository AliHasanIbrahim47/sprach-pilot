import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountSettings } from "@/components/settings/account-settings";
import { AvatarForm } from "@/components/settings/avatar-form";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences";
import { ProfileForm } from "@/components/settings/profile-form";
import { QuietHoursForm } from "@/components/settings/quiet-hours-form";
import { SessionList } from "@/components/settings/session-list";
import { SettingsStepper } from "@/components/settings/settings-stepper";
import { Link } from "@/i18n/navigation";
import { getSettings, getSettingsSessions } from "@/lib/settings";
import {
  changePassword,
  requestEmailChange,
  revokeSettingsSession,
  saveNotificationPreferences,
  saveProfile,
  saveQuietHours,
  uploadAvatar,
} from "@/lib/settings-actions";

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Profile, account, sessions, notifications, and a link to the privacy tools.
 */
export default async function SettingsPage({
  params,
}: SettingsPageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings, sessions] = await Promise.all([
    getTranslations("Settings"),
    getSettings(),
    getSettingsSessions(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("intro")}</p>
      </header>

      <SettingsStepper
        steps={[
          {
            id: "profile",
            title: t("profileTitle"),
            content: (
              <>
                <AvatarForm avatarUrl={settings.profile.avatarUrl} onUpload={uploadAvatar} />
                <ProfileForm profile={settings.profile} onSave={saveProfile} />
              </>
            ),
          },
          {
            id: "account",
            title: t("accountTitle"),
            content: (
              <AccountSettings
                email={settings.profile.email}
                pendingEmail={settings.profile.pendingEmail}
                onChangeEmail={requestEmailChange}
                onChangePassword={changePassword}
              />
            ),
          },
          {
            id: "sessions",
            title: t("sessionsTitle"),
            content: <SessionList sessions={sessions.sessions} onRevoke={revokeSettingsSession} />,
          },
          {
            id: "notifications",
            title: t("notificationsTitle"),
            content: (
              <NotificationPreferencesForm
                preferences={settings.notifications}
                onSave={saveNotificationPreferences}
              />
            ),
          },
          {
            id: "quiet-hours",
            title: t("quietHoursTitle"),
            content: <QuietHoursForm quietHours={settings.quietHours} onSave={saveQuietHours} />,
          },
          {
            id: "privacy",
            title: t("privacyTitle"),
            content: (
              <>
                <p className="text-muted-foreground text-sm">{t("privacyBody")}</p>
                <Link
                  href="/settings/privacy#export"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {t("exportData")}
                </Link>
                <Link
                  href="/settings/privacy#delete"
                  className="text-sm font-medium underline-offset-4 hover:underline text-red-500"
                >
                  {t("deleteAccount")}
                </Link>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
