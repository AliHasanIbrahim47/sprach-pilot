import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { logoutAccount } from "@/lib/auth-actions";

export async function SignOutForm(): Promise<React.JSX.Element> {
  const t = await getTranslations("Auth");

  return (
    <form action={logoutAccount}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-auto px-3 py-2 font-medium"
      >
        {t("signOut")}
      </Button>
    </form>
  );
}
