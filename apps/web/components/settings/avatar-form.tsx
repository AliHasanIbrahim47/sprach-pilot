"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { settingsStatusMessage } from "@/lib/settings-result";

interface AvatarFormProps {
  avatarUrl: string | null;
  onUpload: (file: File) => Promise<{ ok: boolean }>;
}

/**
 * Sends one image. The API rejects files over 5 MB and types that are not images.
 */
export function AvatarForm({ avatarUrl, onUpload }: AvatarFormProps): React.JSX.Element {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function persist(): Promise<boolean> {
    if (!file || file.size === 0) {
      setSummary(t("avatarMissing"));
      return false;
    }
    setIsSaving(true);
    const result = await onUpload(file);
    setIsSaving(false);
    setSummary(settingsStatusMessage(result, t("avatarAccepted"), tErrors));
    if (result.ok) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    return result.ok;
  }

  function discard(): void {
    setFile(null);
    setSummary("");
    if (inputRef.current) inputRef.current.value = "";
  }

  useUnsavedChanges("avatar", { isDirty: file !== null, save: persist, discard });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await persist();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
      {avatarUrl ? (
        // The stored object is already a small WebP. The remote host is the avatar bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={96}
          height={96}
          className="size-24 rounded-full object-cover"
        />
      ) : null}
      <Label htmlFor="avatar">{t("avatarLabel")}</Label>
      <input
        ref={inputRef}
        id="avatar"
        name="avatar"
        type="file"
        className="cursor-pointer hover:opacity-90"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <p className="text-muted-foreground text-sm">{t("avatarHint")}</p>
      {summary ? (
        <p role="status" className="text-sm">
          {summary}
        </p>
      ) : null}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? t("saving") : t("avatarUpload")}
      </Button>
    </form>
  );
}
