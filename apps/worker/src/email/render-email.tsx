import { render } from "@react-email/render";
import type { EmailJob } from "@sprachpilot/shared";

import { emailCopy } from "./copy.js";
import { NoticeEmail, ResetEmail, VerificationEmail } from "./template.js";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(job: EmailJob): Promise<RenderedEmail> {
  const copy = emailCopy(job.locale);

  if (job.template === "registration-notice") {
    const element = <NoticeEmail locale={job.locale} />;
    return {
      subject: copy.noticeSubject,
      html: await render(element),
      text: await render(element, { plainText: true }),
    };
  }

  if (!job.url) throw new Error("missing email url");
  const element =
    job.template === "verify-email" ? (
      <VerificationEmail locale={job.locale} url={job.url} />
    ) : (
      <ResetEmail locale={job.locale} url={job.url} />
    );
  return {
    subject: job.template === "verify-email" ? copy.verifySubject : copy.resetSubject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
