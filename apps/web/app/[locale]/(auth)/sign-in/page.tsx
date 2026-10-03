import { redirect } from "@/i18n/navigation";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
}

/** Older links used /sign-in. Login lives at /login. */
export default async function SignInPage({ params }: SignInPageProps): Promise<void> {
  const { locale } = await params;
  redirect({ href: "/login", locale });
}
