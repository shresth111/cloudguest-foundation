import type { RuntimeLanguage } from "@/types/portal-runtime";

type Dict = Record<string, string>;

const EN: Dict = {
  loading: "Preparing your connection…",
  connect: "Connect",
  learnMore: "Learn more",
  chooseMethod: "Choose how to sign in",
  mobileOtp: "Mobile OTP",
  emailOtp: "Email OTP",
  voucher: "Voucher code",
  pms: "Room login",
  social: "Social login",
  qr: "QR sign-in",
  clickThrough: "One-tap access",
  mobileNumber: "Mobile number",
  emailAddress: "Email address",
  sendOtp: "Send code",
  verifyOtp: "Verify",
  resend: "Resend code",
  changeNumber: "Change destination",
  voucherCode: "Voucher code",
  submit: "Submit",
  roomNumber: "Room number",
  lastName: "Last name",
  scanInstructions: "Open your camera and scan the QR code to connect.",
  agreeTerms: "I agree to the terms of service and privacy policy",
  connectedTitle: "You're connected",
  connectedSubtitle: "High-speed internet is now enabled on this device.",
  logout: "Disconnect",
  continue: "Continue browsing",
  authFailed: "We couldn't sign you in",
  retry: "Try again",
  contactSupport: "Contact support",
  sessionRemaining: "Time remaining",
  dataUsage: "Data usage",
  device: "Device",
  sessionExpired: "Your session has expired",
  reconnect: "Reconnect",
  extend: "Extend session",
  redirecting: "Redirecting you shortly…",
  offlineTitle: "You're offline",
  offlineSubtitle: "Check your WiFi connection and try again.",
  skipAd: "Skip",
  termsTitle: "Terms & privacy",
  welcomeCta: "Get started",
  language: "Language",
  a11y: "Accessibility",
  highContrast: "High contrast",
  largeText: "Large text",
  wifi: "WiFi",
};

const HI: Dict = {
  ...EN,
  loading: "आपका कनेक्शन तैयार किया जा रहा है…",
  connect: "कनेक्ट करें",
  learnMore: "और जानें",
  chooseMethod: "साइन इन करने का तरीका चुनें",
  connectedTitle: "आप कनेक्ट हो गए हैं",
  logout: "डिस्कनेक्ट करें",
};
const AR: Dict = {
  ...EN,
  loading: "جارٍ تجهيز الاتصال…",
  connect: "اتصال",
  learnMore: "معرفة المزيد",
  chooseMethod: "اختر طريقة تسجيل الدخول",
  connectedTitle: "تم الاتصال بنجاح",
  logout: "قطع الاتصال",
};
const FR: Dict = {
  ...EN,
  loading: "Préparation de votre connexion…",
  connect: "Se connecter",
  learnMore: "En savoir plus",
  chooseMethod: "Choisissez une méthode de connexion",
  connectedTitle: "Vous êtes connecté",
  logout: "Déconnexion",
};
const ES: Dict = {
  ...EN,
  loading: "Preparando su conexión…",
  connect: "Conectar",
  learnMore: "Más información",
  chooseMethod: "Elige cómo iniciar sesión",
  connectedTitle: "Estás conectado",
  logout: "Desconectar",
};

const DICTS: Record<RuntimeLanguage, Dict> = { en: EN, hi: HI, ar: AR, fr: FR, es: ES };

export const LANGUAGE_LABEL: Record<RuntimeLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  ar: "العربية",
  fr: "Français",
  es: "Español",
};

export function translate(lang: RuntimeLanguage, key: string): string {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
}

export const RTL_LANGS: RuntimeLanguage[] = ["ar"];
