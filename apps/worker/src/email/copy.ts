import type { UiLocale } from "@sprachpilot/shared";

export interface EmailCopy {
  verifySubject: string;
  verifyPreview: string;
  verifyHeading: string;
  verifyBody: string;
  verifyAction: string;
  verifyFooter: string;
  resetSubject: string;
  resetPreview: string;
  resetHeading: string;
  resetBody: string;
  resetAction: string;
  resetFooter: string;
  fallback: string;
  noticeSubject: string;
  noticePreview: string;
  noticeHeading: string;
  noticeBody: string;
  noticeSignIn: string;
  noticeIgnore: string;
}

const COPIES = new Map<UiLocale, EmailCopy>([
  [
    "en",
    {
      verifySubject: "Verify your SprachPilot email",
      verifyPreview: "Confirm your email address for SprachPilot.",
      verifyHeading: "Verify your email",
      verifyBody:
        "Confirm this address so you can upload documents and join tandem or café sessions.",
      verifyAction: "Verify email",
      verifyFooter: "If you did not create a SprachPilot account, you can ignore this message.",
      resetSubject: "Reset your SprachPilot password",
      resetPreview: "Choose a new SprachPilot password.",
      resetHeading: "Reset your password",
      resetBody:
        "This link expires in one hour. After you choose a new password, other signed-in devices are signed out.",
      resetAction: "Reset password",
      resetFooter: "If you did not ask to reset your password, you can ignore this message.",
      fallback: "If the button does not work, open this link:",
      noticeSubject: "Someone tried to register with your SprachPilot email",
      noticePreview: "No new SprachPilot account was created.",
      noticeHeading: "Registration attempt",
      noticeBody: "Someone tried to create a SprachPilot account using this email address.",
      noticeSignIn: "If that was you, sign in with your existing password.",
      noticeIgnore: "If it was not you, you can ignore this message. No new account was created.",
    },
  ],
  [
    "de",
    {
      verifySubject: "Bestätige deine SprachPilot-E-Mail",
      verifyPreview: "Bestätige deine E-Mail-Adresse für SprachPilot.",
      verifyHeading: "E-Mail bestätigen",
      verifyBody:
        "Bestätige diese Adresse, damit du Dokumente hochladen und an Tandem oder Café teilnehmen kannst.",
      verifyAction: "E-Mail bestätigen",
      verifyFooter:
        "Wenn du kein SprachPilot-Konto erstellt hast, kannst du diese Nachricht ignorieren.",
      resetSubject: "Setze dein SprachPilot-Passwort zurück",
      resetPreview: "Wähle ein neues SprachPilot-Passwort.",
      resetHeading: "Passwort zurücksetzen",
      resetBody:
        "Dieser Link gilt eine Stunde. Danach werden andere angemeldete Geräte abgemeldet.",
      resetAction: "Passwort zurücksetzen",
      resetFooter:
        "Wenn du kein neues Passwort angefordert hast, kannst du diese Nachricht ignorieren.",
      fallback: "Wenn die Schaltfläche nicht funktioniert, öffne diesen Link:",
      noticeSubject: "Jemand hat versucht, sich mit deiner SprachPilot-E-Mail zu registrieren",
      noticePreview: "Es wurde kein neues SprachPilot-Konto erstellt.",
      noticeHeading: "Registrierungsversuch",
      noticeBody: "Jemand hat versucht, mit dieser E-Mail ein SprachPilot-Konto zu erstellen.",
      noticeSignIn: "Wenn du das warst, melde dich mit deinem bestehenden Passwort an.",
      noticeIgnore:
        "Wenn du das nicht warst, kannst du diese Nachricht ignorieren. Es wurde kein neues Konto erstellt.",
    },
  ],
  [
    "ar",
    {
      verifySubject: "أكّد بريد SprachPilot الإلكتروني",
      verifyPreview: "أكّد عنوان بريدك في SprachPilot.",
      verifyHeading: "تأكيد البريد الإلكتروني",
      verifyBody: "أكّد هذا العنوان حتى تتمكن من رفع المستندات والانضمام إلى الترادف أو المقهى.",
      verifyAction: "تأكيد البريد",
      verifyFooter: "إذا لم تنشئ حساب SprachPilot، يمكنك تجاهل هذه الرسالة.",
      resetSubject: "إعادة تعيين كلمة مرور SprachPilot",
      resetPreview: "اختر كلمة مرور جديدة لـ SprachPilot.",
      resetHeading: "إعادة تعيين كلمة المرور",
      resetBody:
        "ينتهي هذا الرابط خلال ساعة. بعد اختيار كلمة مرور جديدة يتم تسجيل الخروج من الأجهزة الأخرى.",
      resetAction: "إعادة تعيين كلمة المرور",
      resetFooter: "إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.",
      fallback: "إذا لم يعمل الزر، افتح هذا الرابط:",
      noticeSubject: "حاول شخص التسجيل ببريد SprachPilot الخاص بك",
      noticePreview: "لم يُنشأ حساب SprachPilot جديد.",
      noticeHeading: "محاولة تسجيل",
      noticeBody: "حاول شخص إنشاء حساب SprachPilot باستخدام هذا البريد.",
      noticeSignIn: "إذا كنت أنت، فسجّل الدخول بكلمة المرور الحالية.",
      noticeIgnore: "إذا لم تكن أنت، يمكنك تجاهل هذه الرسالة. لم يُنشأ حساب جديد.",
    },
  ],
  [
    "uk",
    {
      verifySubject: "Підтвердьте електронну пошту SprachPilot",
      verifyPreview: "Підтвердьте адресу електронної пошти для SprachPilot.",
      verifyHeading: "Підтвердьте електронну пошту",
      verifyBody:
        "Підтвердьте цю адресу, щоб завантажувати документи та приєднуватися до tandem або café.",
      verifyAction: "Підтвердити пошту",
      verifyFooter: "Якщо ви не створювали обліковий запис SprachPilot, проігноруйте цей лист.",
      resetSubject: "Скиньте пароль SprachPilot",
      resetPreview: "Виберіть новий пароль SprachPilot.",
      resetHeading: "Скидання пароля",
      resetBody:
        "Посилання діє одну годину. Після вибору нового пароля інші пристрої буде виведено.",
      resetAction: "Скинути пароль",
      resetFooter: "Якщо ви не просили скинути пароль, проігноруйте цей лист.",
      fallback: "Якщо кнопка не працює, відкрийте це посилання:",
      noticeSubject: "Хтось спробував зареєструватися з вашою поштою SprachPilot",
      noticePreview: "Новий обліковий запис SprachPilot не створено.",
      noticeHeading: "Спроба реєстрації",
      noticeBody: "Хтось спробував створити обліковий запис SprachPilot з цією електронною поштою.",
      noticeSignIn: "Якщо це були ви, увійдіть із наявним паролем.",
      noticeIgnore: "Якщо це були не ви, проігноруйте лист. Новий обліковий запис не створено.",
    },
  ],
  [
    "tr",
    {
      verifySubject: "SprachPilot e-postanı doğrula",
      verifyPreview: "SprachPilot için e-posta adresini doğrula.",
      verifyHeading: "E-postayı doğrula",
      verifyBody:
        "Belge yükleyebilmek ve tandem veya café oturumlarına katılabilmek için bu adresi doğrula.",
      verifyAction: "E-postayı doğrula",
      verifyFooter: "SprachPilot hesabı oluşturmadıysan bu iletiyi yok sayabilirsin.",
      resetSubject: "SprachPilot şifreni sıfırla",
      resetPreview: "Yeni bir SprachPilot şifresi seç.",
      resetHeading: "Şifreyi sıfırla",
      resetBody:
        "Bu bağlantı bir saat geçerlidir. Yeni şifreyi seçtikten sonra diğer cihazların oturumu kapanır.",
      resetAction: "Şifreyi sıfırla",
      resetFooter: "Şifre sıfırlama istemediysen bu iletiyi yok sayabilirsin.",
      fallback: "Düğme çalışmazsa bu bağlantıyı aç:",
      noticeSubject: "Birisi SprachPilot e-postanla kayıt olmayı denedi",
      noticePreview: "Yeni bir SprachPilot hesabı oluşturulmadı.",
      noticeHeading: "Kayıt denemesi",
      noticeBody: "Birisi bu e-postayla bir SprachPilot hesabı oluşturmayı denedi.",
      noticeSignIn: "Bu sendiysen mevcut şifrenle giriş yap.",
      noticeIgnore: "Sen değilsen bu iletiyi yok sayabilirsin. Yeni bir hesap oluşturulmadı.",
    },
  ],
]);

export function emailCopy(locale: UiLocale): EmailCopy {
  const copy = COPIES.get(locale);
  if (!copy) throw new Error("unsupported email locale");
  return copy;
}
