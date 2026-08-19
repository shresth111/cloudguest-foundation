import type { RuntimeLanguage } from "@/types/portal-runtime";

type Dict = Record<string, string>;

const EN: Dict = {
  loading: "Preparing your connection…",
  connect: "Connect",
  learnMore: "Learn more",
  chooseMethod: "Choose how to sign in",
  mobileOtp: "Mobile OTP",
  emailOtp: "Email OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "Password",
  passwordLoginDesc: "Sign in with your saved password",
  voucher: "Voucher code",
  pms: "Room login",
  social: "Social login",
  qr: "QR sign-in",
  clickThrough: "One-tap access",
  mobileNumber: "Mobile number",
  emailAddress: "Email address",
  password: "Password",
  signIn: "Sign in",
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
  setPasswordTitle: "Skip the code next time?",
  setPasswordSubtitle: "Save a password now and sign in with just your number next time.",
  newPassword: "New password",
  confirmPassword: "Confirm password",
  savePassword: "Save password",
  skipForNow: "Skip for now",
  passwordSaved: "Password saved -- you can sign in with it next time.",

  // Closes CampaignOverlay.tsx's bypass-of-translate() gap.
  surveyQuestion: "Quick question",
  sponsored: "Sponsored",
  submitting: "Submitting…",
  sponsorMessage: "A sponsor has a message for you.",
  continueCta: "Continue",
  answerPlaceholder: "Type your answer…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "Currently closed",
  closedSubtitle: "We're currently closed. Please check back during business hours to connect.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "You're already part of this team.",
  teamJoined: "You've joined the team!",
  joinTeam: "Join team",
  teamPageTitle: "Join a team",
  teamPageSubtitle: "Enter the team code your group organizer shared with you.",
  teamJoinedHelper: "Your connection isn't affected -- this only groups you with your team.",
  backToConnection: "Back to my connection",
  teamCodeLabel: "Team code",
  teamCodePlaceholder: "e.g. AB23CD45",

  // Closes PortalShell.tsx's gap (brand fallback + surrounding chrome that
  // was also hardcoded English in the same file).
  guestWifiFallback: "Guest WiFi",
  guestNetwork: "Guest network",
  brandHeadlineBase: "Fast, secure WiFi",
  // {venue} is replaced at render time -- kept as a template rather than a
  // fixed key because the word order around the venue name flips between
  // English ("courtesy of X") and Hindi ("X की ओर से"); translate() itself
  // only maps key -> whole string, so callers do the {venue} substitution.
  courtesyOfTemplate: ", courtesy of {venue}",
  verifyDeviceCta: "Verify your device on the right to get connected.",
  supportAskStaff: "Support: ask venue staff",
  poweredByWyfy: "Powered by Wyfy Guest",

  // Closes GuestSignInCard.tsx's gap -- the actual primary sign-in card
  // rendered for the redesigned guest flow (portal.welcome.tsx); found
  // still fully hardcoded English during this rollout's own visual QA
  // pass, despite AuthMethodForms.tsx (the older per-method fallback it
  // superseded) already being wired through translate().
  welcomeToVenueTemplate: "Welcome to {venue}",
  welcomeBare: "Welcome",
  signInSubtext: "Sign in for complimentary WiFi access on this network.",
  verifyingCode: "Verifying your code…",
  signingIn: "Signing you in…",
  noMethodsAvailable: "No sign-in methods are available. Please contact reception.",
  agreeToThe: "I agree to the",
  termsAcceptableUsePolicy: "Terms & Acceptable Use Policy",
  otpTabSms: "Text me a code",
  otpTabEmail: "Email me a code",
  otpTabWhatsapp: "WhatsApp me a code",
  haveAPassword: "I have a password",
  tellUsAboutYourself: "You're connected! Tell us a bit about yourself",
  optionalLabel: "(optional)",
  nameLabel: "Name",
  savingLabel: "Saving…",
  whatsappNumberLabel: "WhatsApp number",
  sendingLabel: "Sending…",
  sentCodeToPrefix: "We sent a 6-digit code to",
  verifyingLabel: "Verifying…",
  verifyOtpConnect: "Verify OTP & connect",
  resendAvailableInTemplate: "Resend available in {n}s",
  changeNumberLabel: "Change number",
  mobileOrEmailLabel: "Mobile number or email",
  signingInLabel: "Signing in…",
  signInConnect: "Sign in & connect",
  forgotUseOtp: "Forgot? Use OTP instead",
  voucherFallbackPrefix: "This location signs guests in with a voucher code --",
  redeemVoucherLink: "redeem yours here",
  otherWaysToSignIn: "Other ways to sign in",
  useMobileInstead: "Use mobile number instead",
  useEmailInstead: "Use email instead",
  useWhatsappInstead: "Use WhatsApp instead",
  haveVoucherUseInstead: "Have a voucher code? Use it instead",
  savedPasswordsNote: "Saved passwords are set right after your first OTP sign-in.",
  errValidWhatsapp: "Enter a valid WhatsApp number",
  errValidMobile: "Enter a valid mobile number",
  errValidEmail: "Enter a valid email address",
  errEnterCode: "Enter the 6-digit code",
  errAcceptTerms: "Please accept the Terms & Acceptable Use Policy to continue.",
  errPhoneEmailPassword: "Enter your phone/email and password",

  // Closes portal.success.tsx's gap (v4 §6.1 -- the timeout/retry escape
  // hatch this page never had).
  successSlowNotice: "This is taking longer than expected.",
  successStuckNotice: "Still working on it -- you can wait, or try signing in again.",
  signInAgainLink: "Sign in again",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher (v4 §6.7 -- the
  // "2+ OTP channels, no password" case, previously an undiscoverable
  // disclosure link).
  switchOtpChannel: "Get the code another way",

  // Closes portal.session.tsx's new profile nudge card (v4 §6.5 --
  // relocated out of the login funnel, same pattern as the password/team
  // nudges already on this page).
  profileNudgeTitle: "Tell us a bit about yourself",
  profileNudgeSubtitle: "Optional -- helps venue staff recognize you next time.",

  // captive-portal-v7-design-spec.md §7.2 -- accessible names for the
  // sign-in fields, which until v7 had none at all (see AuthFields.tsx).
  // `countryCodeLabel` and `otpCodeLabel` name visually-hidden <label>s;
  // they still have to be translated, because a screen-reader guest who
  // switched the portal to Hindi hears these, not the English.
  countryCodeLabel: "Country code",
  otpCodeLabel: "6-digit code",
  otpCodeHint: "Enter the 6-digit code we sent you.",
};

const HI: Dict = {
  loading: "आपका कनेक्शन तैयार किया जा रहा है…",
  connect: "कनेक्ट करें",
  learnMore: "और जानें",
  chooseMethod: "साइन इन करने का तरीका चुनें",
  mobileOtp: "मोबाइल OTP",
  emailOtp: "ईमेल OTP",
  whatsappOtp: "व्हाट्सऐप OTP",
  passwordLogin: "पासवर्ड",
  passwordLoginDesc: "अपने सेव किए गए पासवर्ड से साइन इन करें",
  voucher: "वाउचर कोड",
  pms: "रूम लॉगिन",
  social: "सोशल लॉगिन",
  qr: "QR साइन-इन",
  clickThrough: "एक-टैप एक्सेस",
  mobileNumber: "मोबाइल नंबर",
  emailAddress: "ईमेल पता",
  password: "पासवर्ड",
  signIn: "साइन इन करें",
  sendOtp: "कोड भेजें",
  verifyOtp: "सत्यापित करें",
  resend: "कोड फिर से भेजें",
  changeNumber: "गंतव्य बदलें",
  voucherCode: "वाउचर कोड",
  submit: "सबमिट करें",
  roomNumber: "कमरा नंबर",
  lastName: "उपनाम",
  scanInstructions: "कनेक्ट करने के लिए अपना कैमरा खोलें और QR कोड स्कैन करें।",
  agreeTerms: "मैं सेवा की शर्तों और गोपनीयता नीति से सहमत हूं",
  connectedTitle: "आप कनेक्ट हो गए हैं",
  connectedSubtitle: "इस डिवाइस पर अब हाई-स्पीड इंटरनेट चालू है।",
  logout: "डिस्कनेक्ट करें",
  continue: "ब्राउज़िंग जारी रखें",
  authFailed: "हम आपको साइन इन नहीं कर सके",
  retry: "फिर कोशिश करें",
  contactSupport: "सहायता से संपर्क करें",
  sessionRemaining: "शेष समय",
  dataUsage: "डेटा उपयोग",
  device: "डिवाइस",
  sessionExpired: "आपका सत्र समाप्त हो गया है",
  reconnect: "फिर से कनेक्ट करें",
  extend: "सत्र बढ़ाएं",
  redirecting: "आपको शीघ्र ही रीडायरेक्ट किया जा रहा है…",
  offlineTitle: "आप ऑफ़लाइन हैं",
  offlineSubtitle: "अपना वाई-फाई कनेक्शन जांचें और फिर से प्रयास करें।",
  skipAd: "छोड़ें",
  termsTitle: "शर्तें और गोपनीयता",
  welcomeCta: "शुरू करें",
  language: "भाषा",
  a11y: "सुगमता",
  highContrast: "उच्च कंट्रास्ट",
  largeText: "बड़ा टेक्स्ट",
  wifi: "वाई-फाई",
  setPasswordTitle: "अगली बार कोड छोड़ना चाहेंगे?",
  setPasswordSubtitle: "अभी एक पासवर्ड सेव करें और अगली बार सिर्फ़ अपने नंबर से साइन इन करें।",
  newPassword: "नया पासवर्ड",
  confirmPassword: "पासवर्ड की पुष्टि करें",
  savePassword: "पासवर्ड सेव करें",
  skipForNow: "अभी के लिए छोड़ें",
  passwordSaved: "पासवर्ड सेव हो गया -- अगली बार आप इससे साइन इन कर सकते हैं।",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "त्वरित प्रश्न",
  sponsored: "प्रायोजित",
  submitting: "सबमिट हो रहा है…",
  sponsorMessage: "एक प्रायोजक का आपके लिए एक संदेश है।",
  continueCta: "जारी रखें",
  answerPlaceholder: "अपना उत्तर लिखें…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "फ़िलहाल बंद है",
  closedSubtitle:
    "हम फ़िलहाल बंद हैं। कृपया कनेक्ट करने के लिए व्यावसायिक घंटों के दौरान फिर से देखें।",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "आप पहले से ही इस टीम का हिस्सा हैं।",
  teamJoined: "आप टीम में शामिल हो गए हैं!",
  joinTeam: "टीम में शामिल हों",
  teamPageTitle: "टीम में जुड़ें",
  teamPageSubtitle: "वह टीम कोड डालें जो आपके ग्रुप ऑर्गनाइज़र ने आपके साथ शेयर किया है।",
  teamJoinedHelper:
    "आपका कनेक्शन प्रभावित नहीं होगा -- यह सिर्फ़ आपको आपकी टीम के साथ ग्रुप करता है।",
  backToConnection: "मेरे कनेक्शन पर वापस जाएं",
  teamCodeLabel: "टीम कोड",
  teamCodePlaceholder: "जैसे AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "गेस्ट वाई-फाई",
  guestNetwork: "गेस्ट नेटवर्क",
  brandHeadlineBase: "तेज़, सुरक्षित वाई-फाई",
  courtesyOfTemplate: ", {venue} की ओर से",
  verifyDeviceCta: "कनेक्ट होने के लिए दाईं ओर अपना डिवाइस सत्यापित करें।",
  supportAskStaff: "सहायता: वेन्यू स्टाफ से पूछें",
  poweredByWyfy: "Wyfy Guest द्वारा संचालित",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue} में आपका स्वागत है",
  welcomeBare: "स्वागत है",
  signInSubtext: "इस नेटवर्क पर मुफ़्त वाई-फाई एक्सेस के लिए साइन इन करें।",
  verifyingCode: "आपका कोड सत्यापित किया जा रहा है…",
  signingIn: "आपको साइन इन किया जा रहा है…",
  noMethodsAvailable: "कोई साइन-इन तरीका उपलब्ध नहीं है। कृपया रिसेप्शन से संपर्क करें।",
  agreeToThe: "मैं सहमत हूं",
  termsAcceptableUsePolicy: "शर्तें और उपयोग नीति",
  otpTabSms: "मुझे कोड मैसेज करें",
  otpTabEmail: "मुझे कोड ईमेल करें",
  otpTabWhatsapp: "मुझे व्हाट्सऐप पर कोड भेजें",
  haveAPassword: "मेरे पास पासवर्ड है",
  tellUsAboutYourself: "आप कनेक्ट हो गए हैं! हमें अपने बारे में थोड़ा बताएं",
  optionalLabel: "(वैकल्पिक)",
  nameLabel: "नाम",
  savingLabel: "सेव हो रहा है…",
  whatsappNumberLabel: "व्हाट्सऐप नंबर",
  sendingLabel: "भेजा जा रहा है…",
  sentCodeToPrefix: "हमने 6 अंकों का कोड यहां भेजा है",
  verifyingLabel: "सत्यापित किया जा रहा है…",
  verifyOtpConnect: "OTP सत्यापित करें और कनेक्ट करें",
  resendAvailableInTemplate: "{n} सेकंड में फिर से भेजें उपलब्ध होगा",
  changeNumberLabel: "नंबर बदलें",
  mobileOrEmailLabel: "मोबाइल नंबर या ईमेल",
  signingInLabel: "साइन इन किया जा रहा है…",
  signInConnect: "साइन इन करें और कनेक्ट करें",
  forgotUseOtp: "भूल गए? OTP का उपयोग करें",
  voucherFallbackPrefix: "यह लोकेशन वाउचर कोड से अतिथियों को साइन इन करती है --",
  redeemVoucherLink: "यहां अपना वाउचर रिडीम करें",
  otherWaysToSignIn: "साइन इन करने के अन्य तरीके",
  useMobileInstead: "इसके बजाय मोबाइल नंबर का उपयोग करें",
  useEmailInstead: "इसके बजाय ईमेल का उपयोग करें",
  useWhatsappInstead: "इसके बजाय व्हाट्सऐप का उपयोग करें",
  haveVoucherUseInstead: "वाउचर कोड है? इसके बजाय उसका उपयोग करें",
  savedPasswordsNote: "सेव किए गए पासवर्ड आपके पहले OTP साइन-इन के तुरंत बाद सेट हो जाते हैं।",
  errValidWhatsapp: "एक मान्य व्हाट्सऐप नंबर दर्ज करें",
  errValidMobile: "एक मान्य मोबाइल नंबर दर्ज करें",
  errValidEmail: "एक मान्य ईमेल पता दर्ज करें",
  errEnterCode: "6 अंकों का कोड दर्ज करें",
  errAcceptTerms: "जारी रखने के लिए कृपया शर्तें और उपयोग नीति स्वीकार करें।",
  errPhoneEmailPassword: "अपना फ़ोन/ईमेल और पासवर्ड दर्ज करें",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "इसमें अपेक्षा से अधिक समय लग रहा है।",
  successStuckNotice:
    "हम अभी भी कोशिश कर रहे हैं -- आप प्रतीक्षा कर सकते हैं, या फिर से साइन इन करने की कोशिश करें।",
  signInAgainLink: "फिर से साइन इन करें",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "कोड पाने का दूसरा तरीका",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "हमें अपने बारे में थोड़ा बताएं",
  profileNudgeSubtitle: "वैकल्पिक -- अगली बार वेन्यू स्टाफ को आपको पहचानने में मदद करता है।",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "देश कोड",
  otpCodeLabel: "6 अंकों का कोड",
  otpCodeHint: "हमने आपको जो 6 अंकों का कोड भेजा है वह दर्ज करें।",
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

// Guest language-choice persistence -- see PortalRuntimeContext.tsx. The
// portal has no authenticated guest identity to key a backend preference
// off reliably (guests aren't logged-in users), so client-side storage is
// the right layer here, not a new backend field. Without this, `language`
// state was a bare `useState` that reset on every remount (reload, an OS's
// own periodic captive-portal re-probe reopening the URL, etc.) -- a real,
// pre-existing bug independent of Hindi.
const LANG_STORAGE_KEY = "cg_portal_lang";
const VALID_LANGS: readonly RuntimeLanguage[] = ["en", "hi", "ar", "fr", "es"];

export function loadPersistedLanguage(): RuntimeLanguage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return VALID_LANGS.includes(v as RuntimeLanguage) ? (v as RuntimeLanguage) : undefined;
  } catch {
    return undefined;
  }
}

export function persistLanguage(lang: RuntimeLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Best-effort only (e.g. localStorage disabled/full in a locked-down
    // captive-portal webview) -- never block the guest's language switch.
  }
}
