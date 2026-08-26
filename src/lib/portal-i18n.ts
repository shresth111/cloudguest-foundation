import {
  RUNTIME_LANGUAGE_LABEL,
  toRuntimeLanguage,
  type RuntimeLanguage,
} from "@/types/portal-runtime";

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
  securityTipLabel: "Stay safe",
  securityTipBody: "Never share your one-time code or password with anyone, including venue staff.",
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
  dataConsentLabel: "I consent to my phone/email, device and session details being collected —",
  dataConsentLearnMore: "see what's collected",
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
  errAcceptDataConsent: "Please consent to the data collection above to continue.",
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

  // ===== v7 Parts 2 & 3 -- welcome surface & attribution mark.
  // Kept as one additive block, EN and HI only, so a parallel workstream
  // rewriting this file has exactly one place to merge.
  //
  // `welcomeEyebrow` is the courtesy line demoted out of the headline so the
  // venue's own name gets the whole `pg-title` budget (v7 §8.3: confirming
  // the venue is the strongest anti-evil-twin signal on this screen). It is
  // NOT `welcomeToVenueTemplate` reworded -- that key is still live and
  // still correct for any surface that wants the greeting and the name in
  // one sentence.
  welcomeEyebrow: "Welcome to",
  // Supersedes `poweredByWyfy` above, which is now unreferenced and can be
  // deleted by whoever next touches this file -- left in place here only so
  // this change is purely additive. The template exists because the brand
  // has to be typographically separable from the verb: the mark renders
  // "Wyfy Guest" in `--pg-ink` while "Powered by" stays `--pg-ink-faint`,
  // and because the word order flips between languages (Hindi puts the
  // brand first) a plain prefix/suffix split would be wrong. Same reason
  // `courtesyOfTemplate` above is a template rather than two keys.
  poweredByTemplate: "Powered by {brand}",
  // ===== end v7 Parts 2 & 3 block
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // Reconcile this block wholesale at merge; nothing above or below it is
  // touched. Keys: stepProgressTemplate, whyWeAskMobile, whyWeAskWhatsapp.
  //
  // §8.2 "show progress honestly" -- a template rather than two fixed
  // strings, matching `resendAvailableInTemplate`'s existing convention,
  // because the word order around the numbers is not stable across
  // languages.
  stepProgressTemplate: "Step {n} of {total}",
  // §8.3-2: "explain why the phone number is needed, in one plain
  // sentence, next to the field." States what happens to the number, not
  // what it is not used for -- the identifier is also the guest's RADIUS
  // username and their stored identity here, so a "we only use it for X"
  // promise would not be true.
  whyWeAskMobile: "We text your one-time sign-in code to this number.",
  whyWeAskWhatsapp: "We send your one-time sign-in code to this WhatsApp number.",
  // ---- end v7 Part 8 block --------------------------------------------
  // ---- portal redesign (shadcn pass) -- ADDED BY THE REDESIGN WORKSTREAM
  // Reconcile this block wholesale at merge; nothing above or below it is
  // touched. State screens (expired/failure/offline/redirect), the
  // deep-link verify/auth-method surfaces, PortalConnectingState, the
  // session nudges and portal.terms were shipped hardcoded-English in 9 of
  // 10 languages; these keys close that. `redirectNoticeTemplate` /
  // `redirectCountdownTemplate` substitute {host}/{n} at the call site,
  // matching `resendAvailableInTemplate`'s existing convention.
  backLabel: "Back",
  authMethodSubtitle: "Complete the form below to get online.",
  verifyTitle: "Enter your code",
  connectingTitle: "Connecting you to the internet…",
  connectingSubtitle: "Just a moment.",
  expiredSubtitle: "You've been disconnected from the network.",
  expiredHelp: "Sign in again to continue using guest WiFi.",
  useOtpInsteadLabel: "Use a one-time code instead",
  failureSubtitle: "Please check your details and try again.",
  failureHelp: "If the issue continues, please ask venue staff for assistance.",
  offlineHelp: "Make sure you're connected to the venue's guest WiFi network, then try again.",
  redirectNoticeTemplate: "You'll be sent to {host} shortly.",
  redirectCountdownTemplate: "Continuing in {n}s",
  continueNowLabel: "Continue now",
  unknownMethodLabel: "Unknown sign-in method.",
  usePasswordInstead: "Sign in with a saved password instead",
  termsReadFullDocument: "Read the full document",
  termsQuestionsAskStaff: "Questions about this network or your data? Ask venue staff.",
  termsBackToSignIn: "Back to sign in",
  nudgeSetPasswordTitle: "Set a password for next time",
  nudgeSetPasswordSubtitle: "Skip the code on your next visit",
  nudgeTeamTitle: "Have a team code?",
  nudgeTeamSubtitle: "Join your group's shared data and quota",
  noExpiryLabel: "No expiry set",
  ipUnknownLabel: "IP unknown",
  disconnectingLabel: "Disconnecting…",
  // ---- end portal-redesign block ---------------------------------------
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
  securityTipLabel: "सुरक्षित रहें",
  securityTipBody: "अपना OTP या पासवर्ड किसी के साथ साझा न करें, वेन्यू स्टाफ के साथ भी नहीं।",
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
  dataConsentLabel: "मैं सहमत हूं कि मेरा फ़ोन/ईमेल, डिवाइस और सेशन विवरण एकत्र किया जाए —",
  dataConsentLearnMore: "विवरण देखें",
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
  errAcceptDataConsent: "जारी रखने के लिए कृपया ऊपर दिए गए डेटा संग्रहण हेतु सहमति दें।",
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

  // ===== v7 Parts 2 & 3 -- welcome surface & attribution. See the EN block.
  // NOT a translation of the English fragment. "Welcome to" cannot stand
  // alone in Hindi -- the venue name comes first ("{venue} में आपका स्वागत
  // है"). As an eyebrow ABOVE the name, the standalone greeting sentence is
  // both grammatical and the natural signage reading, so the two languages
  // arrive at the same layout by different routes. Same per-language
  // authoring escape hatch `courtesyOfTemplate` above already documents.
  welcomeEyebrow: "आपका स्वागत है",
  // Word order flips: the brand leads in Hindi. "Wyfy Guest" is a proper
  // noun and stays Latin, exactly as the superseded `poweredByWyfy` above
  // already had it.
  poweredByTemplate: "{brand} द्वारा संचालित",
  // ===== end v7 Parts 2 & 3 block
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "चरण {n} / {total}",
  whyWeAskMobile: "हम आपका एक-बार का साइन-इन कोड इसी नंबर पर भेजते हैं।",
  whyWeAskWhatsapp: "हम आपका एक-बार का साइन-इन कोड इसी व्हाट्सऐप नंबर पर भेजते हैं।",
  // ---- end v7 Part 8 block --------------------------------------------
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "वापस",
  authMethodSubtitle: "ऑनलाइन होने के लिए नीचे दिया गया फ़ॉर्म भरें।",
  verifyTitle: "अपना कोड दर्ज करें",
  connectingTitle: "आपको इंटरनेट से कनेक्ट किया जा रहा है…",
  connectingSubtitle: "बस एक क्षण।",
  expiredSubtitle: "आपको नेटवर्क से डिस्कनेक्ट कर दिया गया है।",
  expiredHelp: "गेस्ट वाई-फाई का उपयोग जारी रखने के लिए फिर से साइन इन करें।",
  useOtpInsteadLabel: "इसके बजाय OTP का उपयोग करें",
  failureSubtitle: "कृपया अपनी जानकारी जांचें और फिर कोशिश करें।",
  failureHelp: "समस्या बनी रहे तो कृपया वेन्यू स्टाफ से सहायता लें।",
  offlineHelp:
    "सुनिश्चित करें कि आप वेन्यू के गेस्ट वाई-फाई नेटवर्क से जुड़े हैं, फिर से प्रयास करें।",
  redirectNoticeTemplate: "आपको शीघ्र ही {host} पर भेजा जाएगा।",
  redirectCountdownTemplate: "{n} सेकंड में आगे बढ़ रहे हैं",
  continueNowLabel: "अभी जारी रखें",
  unknownMethodLabel: "अज्ञात साइन-इन विधि।",
  usePasswordInstead: "इसके बजाय सहेजे गए पासवर्ड से साइन इन करें",
  termsReadFullDocument: "पूरा दस्तावेज़ पढ़ें",
  termsQuestionsAskStaff: "इस नेटवर्क या अपने डेटा के बारे में प्रश्न? वेन्यू स्टाफ से पूछें।",
  termsBackToSignIn: "साइन इन पर वापस जाएं",
  nudgeSetPasswordTitle: "अगली बार के लिए पासवर्ड सेट करें",
  nudgeSetPasswordSubtitle: "अगली बार कोड की ज़रूरत नहीं पड़ेगी",
  nudgeTeamTitle: "टीम कोड है?",
  nudgeTeamSubtitle: "अपने समूह के साझा डेटा और कोटा से जुड़ें",
  noExpiryLabel: "कोई समय-सीमा नहीं",
  ipUnknownLabel: "IP अज्ञात",
  disconnectingLabel: "डिस्कनेक्ट किया जा रहा है…",
  // ---- end portal-redesign block ---------------------------------------
};
/* The eight Indian languages below match the marketing site's set exactly
 * (`wyfy-guest-website/src/i18n/ui/*.ts`), and each was transcreated from that
 * site's own copy for the same language rather than translated cold from EN --
 * so the venue owner who read wyfyguest.com in Kannada and the guest who signs
 * in on their WiFi in Kannada meet one vocabulary, not two.
 *
 * Every one is a COMPLETE dictionary. None of them spreads `...EN`. That is
 * the whole difference between these and the `AR`/`FR`/`ES` entries they
 * replaced, which defined six keys each and inherited the other 127 in
 * English -- see `RuntimeLanguage`'s own comment.
 *
 * Register differs per language ON PURPOSE, following whatever each locale's
 * website translator established: Marathi, Bengali, Kannada, Gujarati,
 * Punjabi and Malayalam code-mix common English nouns (login, network,
 * session) the way their site copy does, while Tamil and Telugu stay almost
 * entirely in script, as theirs do. The frozen terms -- Wyfy Guest, WiFi,
 * OTP, WhatsApp, UPI, SMS, QR -- are Latin everywhere; that list is
 * `DO_NOT_TRANSLATE` in the website's own scripts/i18n-inventory.mjs.
 *
 * These are guest copy, not marketing copy, so they are deliberately shorter
 * and plainer than the site strings they take their vocabulary from: the
 * reader is standing in a lobby on a phone wanting internet, and half of
 * these strings are buttons and tab labels with a fixed width to fit. */
// Bengali (bn).
const BN: Dict = {
  loading: "আপনার কানেকশন তৈরি করা হচ্ছে…",
  connect: "কানেক্ট করুন",
  learnMore: "আরও জানুন",
  chooseMethod: "Sign in করার পদ্ধতি বাছুন",
  mobileOtp: "মোবাইল OTP",
  emailOtp: "ইমেল OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "পাসওয়ার্ড",
  passwordLoginDesc: "সেভ করা পাসওয়ার্ড দিয়ে sign in করুন",
  voucher: "Voucher কোড",
  pms: "রুম login",
  social: "সোশ্যাল login",
  qr: "QR দিয়ে sign in",
  clickThrough: "এক ট্যাপে কানেক্ট",
  mobileNumber: "মোবাইল নম্বর",
  emailAddress: "ইমেল ঠিকানা",
  password: "পাসওয়ার্ড",
  signIn: "Sign in করুন",
  sendOtp: "কোড পাঠান",
  verifyOtp: "যাচাই করুন",
  resend: "কোড আবার পাঠান",
  changeNumber: "গন্তব্য বদলান",
  voucherCode: "Voucher কোড",
  submit: "জমা দিন",
  roomNumber: "রুম নম্বর",
  lastName: "পদবি",
  scanInstructions: "কানেক্ট করতে ক্যামেরা খুলে QR কোড স্ক্যান করুন।",
  agreeTerms: "আমি পরিষেবার শর্তাবলি ও গোপনীয়তা নীতিতে সম্মত",
  securityTipLabel: "নিরাপদ থাকুন",
  securityTipBody:
    "আপনার OTP বা পাসওয়ার্ড কারও সঙ্গে শেয়ার করবেন না, ভেন্যুর কর্মীদের সঙ্গেও না।",
  connectedTitle: "আপনি কানেক্ট হয়েছেন",
  connectedSubtitle: "এই ডিভাইসে এখন হাই-স্পিড ইন্টারনেট চালু।",
  logout: "ডিসকানেক্ট করুন",
  continue: "ব্রাউজ করতে থাকুন",
  authFailed: "আপনাকে sign in করানো গেল না",
  retry: "আবার চেষ্টা করুন",
  contactSupport: "support-এ যোগাযোগ করুন",
  sessionRemaining: "বাকি সময়",
  dataUsage: "ডেটা ব্যবহার",
  device: "ডিভাইস",
  sessionExpired: "আপনার session শেষ হয়ে গেছে",
  reconnect: "আবার কানেক্ট করুন",
  extend: "Session বাড়ান",
  redirecting: "একটু পরেই আপনাকে পাঠিয়ে দেওয়া হবে…",
  offlineTitle: "আপনি অফলাইন",
  offlineSubtitle: "আপনার WiFi কানেকশন দেখে আবার চেষ্টা করুন।",
  skipAd: "এড়িয়ে যান",
  termsTitle: "শর্তাবলি ও গোপনীয়তা",
  welcomeCta: "শুরু করুন",
  language: "ভাষা",
  a11y: "সুগমতা",
  highContrast: "উচ্চ কনট্রাস্ট",
  largeText: "বড় লেখা",
  wifi: "WiFi",
  setPasswordTitle: "পরের বার কোড এড়াতে চান?",
  setPasswordSubtitle: "এখনই একটা পাসওয়ার্ড সেভ করুন, পরের বার শুধু নম্বর দিয়েই sign in করুন।",
  newPassword: "নতুন পাসওয়ার্ড",
  confirmPassword: "পাসওয়ার্ড আবার লিখুন",
  savePassword: "পাসওয়ার্ড সেভ করুন",
  skipForNow: "এখন থাক",
  passwordSaved: "পাসওয়ার্ড সেভ হয়েছে — পরের বার এটা দিয়েই sign in করতে পারবেন।",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "ছোট্ট একটা প্রশ্ন",
  sponsored: "স্পনসর্ড",
  submitting: "জমা দেওয়া হচ্ছে…",
  sponsorMessage: "একজন স্পনসরের আপনার জন্য একটা বার্তা আছে।",
  continueCta: "চালিয়ে যান",
  answerPlaceholder: "আপনার উত্তর লিখুন…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "এখন বন্ধ",
  closedSubtitle: "আমরা এখন বন্ধ। কানেক্ট করতে কাজের সময়ের মধ্যে আবার দেখুন।",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "আপনি আগে থেকেই এই টিমে আছেন।",
  teamJoined: "আপনি টিমে যোগ দিয়েছেন!",
  joinTeam: "টিমে যোগ দিন",
  teamPageTitle: "একটা টিমে যোগ দিন",
  teamPageSubtitle: "আপনার গ্রুপ অর্গানাইজার যে টিম কোড দিয়েছেন সেটা লিখুন।",
  teamJoinedHelper:
    "আপনার কানেকশনে কোনও প্রভাব পড়বে না — এটা শুধু আপনাকে আপনার টিমের সঙ্গে যুক্ত করে।",
  backToConnection: "আমার কানেকশনে ফিরে যান",
  teamCodeLabel: "টিম কোড",
  teamCodePlaceholder: "যেমন AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "গেস্ট WiFi",
  guestNetwork: "গেস্ট নেটওয়ার্ক",
  brandHeadlineBase: "দ্রুত, নিরাপদ WiFi",
  courtesyOfTemplate: ", {venue}-এর সৌজন্যে",
  verifyDeviceCta: "কানেক্ট হতে ডানদিকে আপনার ডিভাইস যাচাই করুন।",
  supportAskStaff: "support: এখানকার স্টাফকে জিজ্ঞেস করুন",
  poweredByWyfy: "পরিচালনায় Wyfy Guest",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue}-এ স্বাগতম",
  welcomeBare: "স্বাগতম",
  signInSubtext: "এই নেটওয়ার্কে বিনামূল্যে WiFi পেতে sign in করুন।",
  verifyingCode: "আপনার কোড যাচাই করা হচ্ছে…",
  signingIn: "আপনাকে sign in করানো হচ্ছে…",
  noMethodsAvailable: "কোনও sign-in পদ্ধতি চালু নেই। রিসেপশনে যোগাযোগ করুন।",
  agreeToThe: "আমি মেনে নিচ্ছি",
  termsAcceptableUsePolicy: "শর্তাবলি ও গ্রহণযোগ্য ব্যবহার নীতি",
  dataConsentLabel: "আমার ফোন/ইমেল, ডিভাইস এবং সেশন বিবরণ সংগ্রহ করা হবে -- এতে আমি সম্মত —",
  dataConsentLearnMore: "বিস্তারিত দেখুন",
  otpTabSms: "SMS-এ কোড পাঠান",
  otpTabEmail: "ইমেলে কোড পাঠান",
  otpTabWhatsapp: "WhatsApp-এ কোড পাঠান",
  haveAPassword: "আমার পাসওয়ার্ড আছে",
  tellUsAboutYourself: "আপনি কানেক্ট হয়েছেন! নিজের সম্পর্কে একটু বলুন",
  optionalLabel: "(ঐচ্ছিক)",
  nameLabel: "নাম",
  savingLabel: "সেভ হচ্ছে…",
  whatsappNumberLabel: "WhatsApp নম্বর",
  sendingLabel: "পাঠানো হচ্ছে…",
  sentCodeToPrefix: "6 অঙ্কের কোড পাঠানো হয়েছে:",
  verifyingLabel: "যাচাই করা হচ্ছে…",
  verifyOtpConnect: "OTP যাচাই করে কানেক্ট করুন",
  resendAvailableInTemplate: "{n} সেকেন্ড পরে আবার পাঠানো যাবে",
  changeNumberLabel: "নম্বর বদলান",
  mobileOrEmailLabel: "মোবাইল নম্বর বা ইমেল",
  signingInLabel: "Sign in করা হচ্ছে…",
  signInConnect: "Sign in করে কানেক্ট করুন",
  forgotUseOtp: "ভুলে গেছেন? OTP ব্যবহার করুন",
  voucherFallbackPrefix: "এই location-এ অতিথিরা voucher কোড দিয়ে sign in করেন —",
  redeemVoucherLink: "এখানে সেটা ব্যবহার করুন",
  otherWaysToSignIn: "Sign in করার অন্য উপায়",
  useMobileInstead: "বদলে মোবাইল নম্বর দিন",
  useEmailInstead: "বদলে ইমেল দিন",
  useWhatsappInstead: "বদলে WhatsApp দিন",
  haveVoucherUseInstead: "Voucher কোড আছে? সেটাই ব্যবহার করুন",
  savedPasswordsNote: "প্রথম OTP sign-in-এর ঠিক পরেই সেভ করা পাসওয়ার্ড সেট হয়।",
  errValidWhatsapp: "সঠিক WhatsApp নম্বর লিখুন",
  errValidMobile: "সঠিক মোবাইল নম্বর লিখুন",
  errValidEmail: "সঠিক ইমেল ঠিকানা লিখুন",
  errEnterCode: "6 অঙ্কের কোড লিখুন",
  errAcceptTerms: "এগোতে শর্তাবলি ও গ্রহণযোগ্য ব্যবহার নীতি মেনে নিন।",
  errAcceptDataConsent: "এগোতে অনুগ্রহ করে উপরের ডেটা সংগ্রহে সম্মতি দিন।",
  errPhoneEmailPassword: "আপনার ফোন/ইমেল আর পাসওয়ার্ড লিখুন",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "ভাবার চেয়ে একটু বেশি সময় লাগছে।",
  successStuckNotice: "চেষ্টা এখনও চলছে — অপেক্ষা করতে পারেন, বা আবার sign in করে দেখুন।",
  signInAgainLink: "আবার sign in করুন",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "অন্যভাবে কোড নিন",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "নিজের সম্পর্কে একটু বলুন",
  profileNudgeSubtitle: "ঐচ্ছিক — পরের বার স্টাফের আপনাকে চিনতে সুবিধা হয়।",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "দেশের কোড",
  otpCodeLabel: "6 অঙ্কের কোড",
  otpCodeHint: "আমরা যে 6 অঙ্কের কোড পাঠিয়েছি সেটা লিখুন।",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "পিছনে",
  authMethodSubtitle: "অনলাইনে যেতে নিচের ফর্মটি পূরণ করুন।",
  verifyTitle: "আপনার কোড লিখুন",
  connectingTitle: "আপনাকে ইন্টারনেটে কানেক্ট করা হচ্ছে…",
  connectingSubtitle: "একটু অপেক্ষা করুন।",
  expiredSubtitle: "আপনাকে নেটওয়ার্ক থেকে disconnect করা হয়েছে।",
  expiredHelp: "Guest WiFi ব্যবহার চালিয়ে যেতে আবার sign in করুন।",
  useOtpInsteadLabel: "বদলে OTP ব্যবহার করুন",
  failureSubtitle: "আপনার তথ্য দেখে আবার চেষ্টা করুন।",
  failureHelp: "সমস্যা চলতে থাকলে এখানকার স্টাফকে জিজ্ঞেস করুন।",
  offlineHelp: "আপনি এই জায়গার guest WiFi নেটওয়ার্কে যুক্ত আছেন কি না দেখে আবার চেষ্টা করুন।",
  redirectNoticeTemplate: "একটু পরেই আপনাকে {host}-এ পাঠানো হবে।",
  redirectCountdownTemplate: "{n} সেকেন্ডে এগোচ্ছি",
  continueNowLabel: "এখনই যান",
  unknownMethodLabel: "অজানা sign in পদ্ধতি।",
  usePasswordInstead: "বদলে সেভ করা পাসওয়ার্ড দিয়ে sign in করুন",
  termsReadFullDocument: "পুরো নথিটি পড়ুন",
  termsQuestionsAskStaff: "এই নেটওয়ার্ক বা আপনার ডেটা নিয়ে প্রশ্ন? এখানকার স্টাফকে জিজ্ঞেস করুন।",
  termsBackToSignIn: "Sign in-এ ফিরে যান",
  nudgeSetPasswordTitle: "পরের বারের জন্য পাসওয়ার্ড সেট করুন",
  nudgeSetPasswordSubtitle: "পরের বার আর কোড লাগবে না",
  nudgeTeamTitle: "Team কোড আছে?",
  nudgeTeamSubtitle: "আপনার দলের শেয়ার করা ডেটা ও কোটায় যোগ দিন",
  noExpiryLabel: "কোনো মেয়াদ নেই",
  ipUnknownLabel: "IP অজানা",
  disconnectingLabel: "Disconnect করা হচ্ছে…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "ধাপ {n} / {total}",
  whyWeAskMobile: "আপনার একবারের sign-in কোড আমরা এই নম্বরে SMS-এ পাঠাই।",
  whyWeAskWhatsapp: "আপনার একবারের sign-in কোড আমরা এই WhatsApp নম্বরে পাঠাই।",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Marathi (mr).
const MR: Dict = {
  loading: "तुमचं connection तयार करत आहोत…",
  connect: "Connect करा",
  learnMore: "अधिक जाणून घ्या",
  chooseMethod: "Sign in कसं करायचं ते निवडा",
  mobileOtp: "मोबाइल OTP",
  emailOtp: "Email चा OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "Password ने login",
  passwordLoginDesc: "तुमच्या save केलेल्या password ने sign in करा",
  voucher: "Voucher चा code",
  pms: "Room ने login",
  social: "Social ने login",
  qr: "QR ने sign in",
  clickThrough: "एका click वर access",
  mobileNumber: "मोबाइल नंबर",
  emailAddress: "Email पत्ता",
  password: "तुमचा password",
  signIn: "Sign in करा",
  sendOtp: "Code पाठवा",
  verifyOtp: "तपासा",
  resend: "Code पुन्हा पाठवा",
  changeNumber: "कुठे पाठवायचं ते बदला",
  voucherCode: "Voucher चा code",
  submit: "पाठवा",
  roomNumber: "Room नंबर",
  lastName: "आडनाव",
  scanInstructions: "Connect करण्यासाठी तुमचा camera उघडा आणि QR code scan करा.",
  agreeTerms: "मी Terms of Service आणि Privacy Policy शी सहमत आहे",
  securityTipLabel: "सुरक्षित राहा",
  securityTipBody: "तुमचा OTP किंवा password कोणाशीही शेअर करू नका, व्हेन्यू स्टाफसोबतही नाही.",
  connectedTitle: "तुम्ही आता online आहात",
  connectedSubtitle: "या device वर आता high-speed internet चालू आहे.",
  logout: "Disconnect करा",
  continue: "Browse करत राहा",
  authFailed: "Sign in होऊ शकलं नाही",
  retry: "पुन्हा प्रयत्न करा",
  contactSupport: "Support शी संपर्क साधा",
  sessionRemaining: "उरलेला वेळ",
  dataUsage: "Data वापर",
  device: "तुमचं device",
  sessionExpired: "तुमचं session संपलं आहे",
  reconnect: "पुन्हा connect करा",
  extend: "Session वाढवा",
  redirecting: "लवकरच तुम्हाला पुढे नेत आहोत…",
  offlineTitle: "तुम्ही offline आहात",
  offlineSubtitle: "तुमचं WiFi connection तपासा आणि पुन्हा प्रयत्न करा.",
  skipAd: "वगळा",
  termsTitle: "Terms आणि Privacy",
  welcomeCta: "सुरू करा",
  language: "भाषा",
  a11y: "सुलभता",
  highContrast: "जास्त contrast",
  largeText: "मोठा मजकूर",
  wifi: "WiFi",
  setPasswordTitle: "पुढच्या वेळी code नको?",
  setPasswordSubtitle: "आता password save करा आणि पुढच्या वेळी फक्त तुमच्या नंबरने sign in करा.",
  newPassword: "नवा password",
  confirmPassword: "Password पुन्हा टाका",
  savePassword: "Password save करा",
  skipForNow: "आत्ता नको",
  passwordSaved: "Password save झाला — पुढच्या वेळी त्याने sign in करता येईल.",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "छोटासा प्रश्न",
  sponsored: "प्रायोजित",
  submitting: "नोंदवत आहोत…",
  sponsorMessage: "एका प्रायोजकाचा तुमच्यासाठी संदेश आहे.",
  continueCta: "पुढे जा",
  answerPlaceholder: "तुमचं उत्तर लिहा…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "सध्या बंद आहे",
  closedSubtitle: "आम्ही सध्या बंद आहोत. Connect करण्यासाठी कृपया कामाच्या वेळेत पुन्हा या.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "तुम्ही आधीच या team चा भाग आहात.",
  teamJoined: "तुम्ही team मध्ये सामील झालात!",
  joinTeam: "Team मध्ये सामील व्हा",
  teamPageTitle: "एका team मध्ये सामील व्हा",
  teamPageSubtitle: "तुमच्या group organizer ने दिलेला team code टाका.",
  teamJoinedHelper:
    "तुमच्या connection वर याचा परिणाम होत नाही — हे फक्त तुम्हाला तुमच्या team सोबत जोडतं.",
  backToConnection: "माझ्या connection कडे परत",
  teamCodeLabel: "Team चा code",
  teamCodePlaceholder: "उदा. AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "पाहुण्यांचं WiFi",
  guestNetwork: "पाहुण्यांचं network",
  brandHeadlineBase: "वेगवान, सुरक्षित WiFi",
  courtesyOfTemplate: ", {venue} च्या सौजन्याने",
  verifyDeviceCta: "Connect होण्यासाठी उजवीकडे तुमचं device तपासून घ्या.",
  supportAskStaff: "Support: इथल्या staff ला विचारा",
  poweredByWyfy: "Wyfy Guest वर चालतं",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue} मध्ये स्वागत आहे",
  welcomeBare: "स्वागत आहे",
  signInSubtext: "या network वर मोफत WiFi साठी sign in करा.",
  verifyingCode: "तुमचा code तपासत आहोत…",
  signingIn: "तुम्हाला sign in करत आहोत…",
  noMethodsAvailable: "Sign in करण्याचा कोणताही मार्ग उपलब्ध नाही. कृपया Reception शी संपर्क साधा.",
  agreeToThe: "मी सहमत आहे",
  termsAcceptableUsePolicy: "Terms आणि Acceptable Use Policy",
  dataConsentLabel: "माझा फोन/ईमेल, डिव्हाइस आणि सेशन तपशील गोळा केला जाईल -- यासाठी मी सहमत आहे —",
  dataConsentLearnMore: "अधिक पाहा",
  otpTabSms: "मला code SMS करा",
  otpTabEmail: "मला code email करा",
  otpTabWhatsapp: "मला WhatsApp वर code पाठवा",
  haveAPassword: "माझ्याकडे password आहे",
  tellUsAboutYourself: "तुम्ही आता online आहात! तुमच्याबद्दल थोडं सांगा",
  optionalLabel: "(ऐच्छिक)",
  nameLabel: "नाव",
  savingLabel: "Save करत आहोत…",
  whatsappNumberLabel: "WhatsApp नंबर",
  sendingLabel: "पाठवत आहोत…",
  sentCodeToPrefix: "आम्ही 6 अंकी code इथे पाठवला आहे",
  verifyingLabel: "तपासत आहोत…",
  verifyOtpConnect: "OTP तपासा आणि connect करा",
  resendAvailableInTemplate: "{n}s नंतर पुन्हा पाठवता येईल",
  changeNumberLabel: "नंबर बदला",
  mobileOrEmailLabel: "मोबाइल नंबर किंवा email",
  signingInLabel: "Sign in करत आहोत…",
  signInConnect: "Sign in करा आणि connect करा",
  forgotUseOtp: "विसरलात? OTP वापरा",
  voucherFallbackPrefix: "इथे पाहुणे voucher code ने sign in करतात —",
  redeemVoucherLink: "तुमचा code इथे वापरा",
  otherWaysToSignIn: "Sign in करण्याचे इतर मार्ग",
  useMobileInstead: "त्याऐवजी मोबाइल नंबर वापरा",
  useEmailInstead: "त्याऐवजी email वापरा",
  useWhatsappInstead: "त्याऐवजी WhatsApp वापरा",
  haveVoucherUseInstead: "Voucher code आहे? तो वापरा",
  savedPasswordsNote: "Save केलेला password तुमच्या पहिल्या OTP sign-in नंतर लगेच ठरवला जातो.",
  errValidWhatsapp: "योग्य WhatsApp नंबर टाका",
  errValidMobile: "योग्य मोबाइल नंबर टाका",
  errValidEmail: "योग्य email पत्ता टाका",
  errEnterCode: "6 अंकी code टाका",
  errAcceptTerms: "पुढे जाण्यासाठी कृपया Terms & Acceptable Use Policy मान्य करा.",
  errAcceptDataConsent: "पुढे जाण्यासाठी कृपया वरील डेटा संकलनास सहमती द्या.",
  errPhoneEmailPassword: "तुमचा फोन/email आणि password टाका",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "अपेक्षेपेक्षा जास्त वेळ लागतो आहे.",
  successStuckNotice: "अजून प्रयत्न सुरू आहे — तुम्ही थांबू शकता, किंवा पुन्हा sign in करून पाहा.",
  signInAgainLink: "पुन्हा sign in करा",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "Code दुसऱ्या मार्गाने मिळवा",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "तुमच्याबद्दल थोडं सांगा",
  profileNudgeSubtitle: "ऐच्छिक — पुढच्या वेळी इथल्या staff ला तुम्ही ओळखू येता.",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "देशाचा code",
  otpCodeLabel: "6 अंकी code",
  otpCodeHint: "आम्ही पाठवलेला 6 अंकी code टाका.",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "मागे",
  authMethodSubtitle: "Online होण्यासाठी खालचा फॉर्म भरा.",
  verifyTitle: "तुमचा कोड टाका",
  connectingTitle: "तुम्हाला इंटरनेटशी connect करत आहोत…",
  connectingSubtitle: "फक्त एक क्षण.",
  expiredSubtitle: "तुम्ही network वरून disconnect झाला आहात.",
  expiredHelp: "Guest WiFi वापरत राहण्यासाठी पुन्हा sign in करा.",
  useOtpInsteadLabel: "त्याऐवजी OTP वापरा",
  failureSubtitle: "तुमची माहिती तपासा आणि पुन्हा प्रयत्न करा.",
  failureHelp: "समस्या राहिली तर इथल्या staff ला विचारा.",
  offlineHelp:
    "तुम्ही इथल्या guest WiFi network शी जोडलेले आहात का ते पाहा, मग पुन्हा प्रयत्न करा.",
  redirectNoticeTemplate: "लवकरच तुम्हाला {host} वर नेत आहोत.",
  redirectCountdownTemplate: "{n} सेकंदात पुढे जात आहोत",
  continueNowLabel: "आत्ताच पुढे जा",
  unknownMethodLabel: "अनोळखी sign in पद्धत.",
  usePasswordInstead: "त्याऐवजी सेव्ह केलेल्या पासवर्डने sign in करा",
  termsReadFullDocument: "संपूर्ण दस्तऐवज वाचा",
  termsQuestionsAskStaff:
    "या network बद्दल किंवा तुमच्या डेटाबद्दल प्रश्न? इथल्या staff ला विचारा.",
  termsBackToSignIn: "Sign in कडे परत",
  nudgeSetPasswordTitle: "पुढच्या वेळेसाठी पासवर्ड सेट करा",
  nudgeSetPasswordSubtitle: "पुढच्या भेटीत कोड लागणार नाही",
  nudgeTeamTitle: "Team कोड आहे?",
  nudgeTeamSubtitle: "तुमच्या गटाच्या शेअर केलेल्या डेटा व कोट्यात सामील व्हा",
  noExpiryLabel: "मुदत नाही",
  ipUnknownLabel: "IP माहीत नाही",
  disconnectingLabel: "Disconnect करत आहोत…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "टप्पा {n} / {total}",
  whyWeAskMobile: "आम्ही तुमचा एक-वेळचा sign-in code याच नंबरवर SMS करतो.",
  whyWeAskWhatsapp: "आम्ही तुमचा एक-वेळचा sign-in code याच WhatsApp नंबरवर पाठवतो.",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Telugu (te).
const TE: Dict = {
  loading: "మీ కనెక్షన్ సిద్ధం చేస్తున్నాం…",
  connect: "కనెక్ట్ చేయండి",
  learnMore: "మరింత తెలుసుకోండి",
  chooseMethod: "సైన్ ఇన్ ఎలా చేయాలో ఎంచుకోండి",
  mobileOtp: "మొబైల్ OTP",
  emailOtp: "ఈమెయిల్ OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "పాస్‌వర్డ్",
  passwordLoginDesc: "మీరు సేవ్ చేసిన పాస్‌వర్డ్‌తో సైన్ ఇన్ అవ్వండి",
  voucher: "Voucher కోడ్",
  pms: "గది లాగిన్",
  social: "సోషల్ లాగిన్",
  qr: "QR సైన్-ఇన్",
  clickThrough: "ఒకే ట్యాప్ యాక్సెస్",
  mobileNumber: "మొబైల్ నంబర్",
  emailAddress: "ఈమెయిల్ చిరునామా",
  password: "పాస్‌వర్డ్",
  signIn: "సైన్ ఇన్ అవ్వండి",
  sendOtp: "కోడ్ పంపండి",
  verifyOtp: "ధృవీకరించండి",
  resend: "కోడ్ మళ్లీ పంపండి",
  changeNumber: "పంపే చోటు మార్చండి",
  voucherCode: "Voucher కోడ్",
  submit: "సబ్మిట్ చేయండి",
  roomNumber: "గది నంబర్",
  lastName: "ఇంటిపేరు",
  scanInstructions: "కనెక్ట్ కావడానికి మీ కెమెరా తెరిచి QR కోడ్ స్కాన్ చేయండి.",
  agreeTerms: "సేవా నిబంధనలు, గోప్యతా విధానానికి నేను అంగీకరిస్తున్నాను",
  securityTipLabel: "సురక్షితంగా ఉండండి",
  securityTipBody: "మీ OTP లేదా పాస్‌వర్డ్‌ను ఎవరితోనూ, వేదిక సిబ్బందితో కూడా, పంచుకోకండి.",
  connectedTitle: "మీరు కనెక్ట్ అయ్యారు",
  connectedSubtitle: "ఈ డివైస్‌లో ఇప్పుడు హై-స్పీడ్ ఇంటర్నెట్ ఆన్ అయ్యింది.",
  logout: "డిస్‌కనెక్ట్ చేయండి",
  continue: "బ్రౌజింగ్ కొనసాగించండి",
  authFailed: "మిమ్మల్ని సైన్ ఇన్ చేయలేకపోయాం",
  retry: "మళ్లీ ప్రయత్నించండి",
  contactSupport: "సపోర్ట్‌ను సంప్రదించండి",
  sessionRemaining: "మిగిలిన సమయం",
  dataUsage: "డేటా వాడకం",
  device: "డివైస్",
  sessionExpired: "మీ సెషన్ ముగిసింది",
  reconnect: "మళ్లీ కనెక్ట్ చేయండి",
  extend: "సెషన్ పొడిగించండి",
  redirecting: "కాసేపట్లో మిమ్మల్ని రీడైరెక్ట్ చేస్తున్నాం…",
  offlineTitle: "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు",
  offlineSubtitle: "మీ WiFi కనెక్షన్ చూసుకుని మళ్లీ ప్రయత్నించండి.",
  skipAd: "దాటవేయండి",
  termsTitle: "నిబంధనలు, గోప్యత",
  welcomeCta: "మొదలుపెట్టండి",
  language: "భాష",
  a11y: "సౌలభ్యం",
  highContrast: "హై కాంట్రాస్ట్",
  largeText: "పెద్ద అక్షరాలు",
  wifi: "WiFi",
  setPasswordTitle: "వచ్చేసారి కోడ్ లేకుండా వెళ్లాలా?",
  setPasswordSubtitle:
    "ఇప్పుడే పాస్‌వర్డ్ సేవ్ చేసుకోండి, వచ్చేసారి మీ నంబర్‌తోనే సైన్ ఇన్ అవ్వండి.",
  newPassword: "కొత్త పాస్‌వర్డ్",
  confirmPassword: "పాస్‌వర్డ్ నిర్ధారించండి",
  savePassword: "పాస్‌వర్డ్ సేవ్ చేయండి",
  skipForNow: "ఇప్పుడు వద్దు",
  passwordSaved: "పాస్‌వర్డ్ సేవ్ అయ్యింది -- వచ్చేసారి దీనితోనే సైన్ ఇన్ అవ్వచ్చు.",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "చిన్న ప్రశ్న",
  sponsored: "స్పాన్సర్ చేసినది",
  submitting: "సబ్మిట్ అవుతోంది…",
  sponsorMessage: "ఒక స్పాన్సర్ నుంచి మీకో సందేశం.",
  continueCta: "కొనసాగించండి",
  answerPlaceholder: "మీ సమాధానం రాయండి…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "ప్రస్తుతం మూసి ఉంది",
  closedSubtitle: "మేం ప్రస్తుతం మూసి ఉన్నాం. కనెక్ట్ కావడానికి పని వేళల్లో మళ్లీ ప్రయత్నించండి.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "మీరు ఇప్పటికే ఈ టీమ్‌లో ఉన్నారు.",
  teamJoined: "మీరు టీమ్‌లో చేరారు!",
  joinTeam: "టీమ్‌లో చేరండి",
  teamPageTitle: "ఒక టీమ్‌లో చేరండి",
  teamPageSubtitle: "మీ గ్రూప్ నిర్వాహకులు ఇచ్చిన టీమ్ కోడ్ ఇవ్వండి.",
  teamJoinedHelper: "మీ కనెక్షన్‌కు ఏమీ కాదు -- ఇది మిమ్మల్ని మీ టీమ్‌తో కలిపి చూపుతుంది అంతే.",
  backToConnection: "నా కనెక్షన్‌కు తిరిగి వెళ్లండి",
  teamCodeLabel: "టీమ్ కోడ్",
  teamCodePlaceholder: "ఉదా. AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "గెస్ట్ WiFi",
  guestNetwork: "గెస్ట్ నెట్‌వర్క్",
  brandHeadlineBase: "వేగవంతమైన, సురక్షితమైన WiFi",
  courtesyOfTemplate: ", {venue} సౌజన్యంతో",
  verifyDeviceCta: "కనెక్ట్ కావడానికి కుడివైపు మీ డివైస్‌ను ధృవీకరించండి.",
  supportAskStaff: "సపోర్ట్: సిబ్బందిని అడగండి",
  poweredByWyfy: "Wyfy Guest పై నడుస్తుంది",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue}కు స్వాగతం",
  welcomeBare: "స్వాగతం",
  signInSubtext: "ఈ నెట్‌వర్క్‌లో ఉచిత WiFi యాక్సెస్ కోసం సైన్ ఇన్ అవ్వండి.",
  verifyingCode: "మీ కోడ్ ధృవీకరిస్తున్నాం…",
  signingIn: "మిమ్మల్ని సైన్ ఇన్ చేస్తున్నాం…",
  noMethodsAvailable: "సైన్-ఇన్ పద్ధతులేవీ అందుబాటులో లేవు. దయచేసి రిసెప్షన్‌ను సంప్రదించండి.",
  agreeToThe: "నేను అంగీకరిస్తున్నాను:",
  termsAcceptableUsePolicy: "నిబంధనలు, వినియోగ విధానం",
  dataConsentLabel:
    "నా ఫోన్/ఇమెయిల్, డివైస్ మరియు సెషన్ వివరాలు సేకరించడానికి నేను అంగీకరిస్తున్నాను —",
  dataConsentLearnMore: "వివరాలు చూడండి",
  otpTabSms: "SMSలో కోడ్ పంపండి",
  otpTabEmail: "ఈమెయిల్‌లో కోడ్ పంపండి",
  otpTabWhatsapp: "WhatsAppలో కోడ్ పంపండి",
  haveAPassword: "నా దగ్గర పాస్‌వర్డ్ ఉంది",
  tellUsAboutYourself: "మీరు కనెక్ట్ అయ్యారు! మీ గురించి కొంచెం చెప్పండి",
  optionalLabel: "(ఐచ్ఛికం)",
  nameLabel: "పేరు",
  savingLabel: "సేవ్ అవుతోంది…",
  whatsappNumberLabel: "WhatsApp నంబర్",
  sendingLabel: "పంపుతున్నాం…",
  sentCodeToPrefix: "6 అంకెల కోడ్ ఇక్కడికి పంపాం:",
  verifyingLabel: "ధృవీకరిస్తున్నాం…",
  verifyOtpConnect: "OTP ధృవీకరించి కనెక్ట్ అవ్వండి",
  resendAvailableInTemplate: "{n} సెకన్లలో మళ్లీ పంపవచ్చు",
  changeNumberLabel: "నంబర్ మార్చండి",
  mobileOrEmailLabel: "మొబైల్ నంబర్ లేదా ఈమెయిల్",
  signingInLabel: "సైన్ ఇన్ అవుతోంది…",
  signInConnect: "సైన్ ఇన్ అయ్యి కనెక్ట్ అవ్వండి",
  forgotUseOtp: "మర్చిపోయారా? OTP వాడండి",
  voucherFallbackPrefix: "ఈ లొకేషన్ అతిథులను voucher కోడ్‌తో సైన్ ఇన్ చేస్తుంది --",
  redeemVoucherLink: "మీ కోడ్ ఇక్కడ వాడండి",
  otherWaysToSignIn: "సైన్ ఇన్ కావడానికి ఇతర మార్గాలు",
  useMobileInstead: "బదులుగా మొబైల్ నంబర్ వాడండి",
  useEmailInstead: "బదులుగా ఈమెయిల్ వాడండి",
  useWhatsappInstead: "బదులుగా WhatsApp వాడండి",
  haveVoucherUseInstead: "Voucher కోడ్ ఉందా? దాన్నే వాడండి",
  savedPasswordsNote: "మీ మొదటి OTP సైన్-ఇన్ తర్వాతే సేవ్ చేసిన పాస్‌వర్డ్‌లు ఏర్పాటవుతాయి.",
  errValidWhatsapp: "సరైన WhatsApp నంబర్ ఇవ్వండి",
  errValidMobile: "సరైన మొబైల్ నంబర్ ఇవ్వండి",
  errValidEmail: "సరైన ఈమెయిల్ చిరునామా ఇవ్వండి",
  errEnterCode: "6 అంకెల కోడ్ ఇవ్వండి",
  errAcceptTerms: "కొనసాగడానికి నిబంధనలు, వినియోగ విధానాన్ని అంగీకరించండి.",
  errAcceptDataConsent: "కొనసాగడానికి దయచేసి పై డేటా సేకరణకు అంగీకరించండి.",
  errPhoneEmailPassword: "మీ ఫోన్/ఈమెయిల్, పాస్‌వర్డ్ ఇవ్వండి",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "అనుకున్నదానికంటే ఎక్కువ సమయం పడుతోంది.",
  successStuckNotice: "ఇంకా ప్రయత్నిస్తున్నాం -- మీరు ఆగవచ్చు, లేదా మళ్లీ సైన్ ఇన్ అవ్వచ్చు.",
  signInAgainLink: "మళ్లీ సైన్ ఇన్ అవ్వండి",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "కోడ్ మరో విధంగా పొందండి",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "మీ గురించి కొంచెం చెప్పండి",
  profileNudgeSubtitle: "ఐచ్ఛికం -- వచ్చేసారి సిబ్బంది మిమ్మల్ని గుర్తుపట్టేందుకు ఉపయోగపడుతుంది.",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "దేశ కోడ్",
  otpCodeLabel: "6 అంకెల కోడ్",
  otpCodeHint: "మేం పంపిన 6 అంకెల కోడ్ ఇవ్వండి.",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "వెనుకకు",
  authMethodSubtitle: "ఆన్‌లైన్ కావడానికి కింది ఫారం నింపండి.",
  verifyTitle: "మీ కోడ్ ఇవ్వండి",
  connectingTitle: "మిమ్మల్ని ఇంటర్నెట్‌కు కనెక్ట్ చేస్తున్నాం…",
  connectingSubtitle: "ఒక్క క్షణం.",
  expiredSubtitle: "మిమ్మల్ని నెట్‌వర్క్ నుంచి డిస్‌కనెక్ట్ చేశాం.",
  expiredHelp: "గెస్ట్ WiFi వాడటం కొనసాగించడానికి మళ్లీ సైన్ ఇన్ అవ్వండి.",
  useOtpInsteadLabel: "బదులుగా OTP వాడండి",
  failureSubtitle: "మీ వివరాలు చూసుకుని మళ్లీ ప్రయత్నించండి.",
  failureHelp: "సమస్య కొనసాగితే సిబ్బందిని అడగండి.",
  offlineHelp:
    "మీరు ఇక్కడి గెస్ట్ WiFi నెట్‌వర్క్‌కు కనెక్ట్ అయ్యారో లేదో చూసుకుని మళ్లీ ప్రయత్నించండి.",
  redirectNoticeTemplate: "కాసేపట్లో మిమ్మల్ని {host}కు పంపుతాం.",
  redirectCountdownTemplate: "{n} సెకన్లలో ముందుకు వెళ్తున్నాం",
  continueNowLabel: "ఇప్పుడే కొనసాగించండి",
  unknownMethodLabel: "తెలియని సైన్ ఇన్ పద్ధతి.",
  usePasswordInstead: "బదులుగా సేవ్ చేసిన పాస్‌వర్డ్‌తో సైన్ ఇన్ అవ్వండి",
  termsReadFullDocument: "పూర్తి పత్రాన్ని చదవండి",
  termsQuestionsAskStaff: "ఈ నెట్‌వర్క్ లేదా మీ డేటా గురించి ప్రశ్నలా? సిబ్బందిని అడగండి.",
  termsBackToSignIn: "సైన్ ఇన్‌కు తిరిగి వెళ్లండి",
  nudgeSetPasswordTitle: "వచ్చేసారికి పాస్‌వర్డ్ సెట్ చేయండి",
  nudgeSetPasswordSubtitle: "వచ్చేసారి కోడ్ అవసరం ఉండదు",
  nudgeTeamTitle: "టీమ్ కోడ్ ఉందా?",
  nudgeTeamSubtitle: "మీ బృందపు షేర్డ్ డేటా, కోటాలో చేరండి",
  noExpiryLabel: "గడువు లేదు",
  ipUnknownLabel: "IP తెలియదు",
  disconnectingLabel: "డిస్‌కనెక్ట్ చేస్తున్నాం…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "దశ {n} / {total}",
  whyWeAskMobile: "మీ వన్-టైమ్ సైన్-ఇన్ కోడ్‌ను ఈ నంబర్‌కు SMSలో పంపుతాం.",
  whyWeAskWhatsapp: "మీ వన్-టైమ్ సైన్-ఇన్ కోడ్‌ను ఈ WhatsApp నంబర్‌కు పంపుతాం.",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Tamil (ta).
const TA: Dict = {
  loading: "உங்கள் இணைப்பு தயாராகிறது…",
  connect: "இணைக்க",
  learnMore: "மேலும் அறிக",
  chooseMethod: "நுழையும் முறையைத் தேர்ந்தெடுங்கள்",
  mobileOtp: "மொபைல் OTP",
  emailOtp: "மின்னஞ்சல் OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "கடவுச்சொல்",
  passwordLoginDesc: "சேமித்த கடவுச்சொல்லுடன் நுழையுங்கள்",
  voucher: "வவுச்சர் குறியீடு",
  pms: "அறை நுழைவு",
  social: "சமூக ஊடக நுழைவு",
  qr: "QR நுழைவு",
  clickThrough: "ஒரு தட்டு அணுகல்",
  mobileNumber: "மொபைல் எண்",
  emailAddress: "மின்னஞ்சல் முகவரி",
  password: "கடவுச்சொல்",
  signIn: "நுழையுங்கள்",
  sendOtp: "குறியீடு அனுப்பு",
  verifyOtp: "சரிபார்",
  resend: "குறியீட்டை மீண்டும் அனுப்பு",
  changeNumber: "இலக்கை மாற்று",
  voucherCode: "வவுச்சர் குறியீடு",
  submit: "சமர்ப்பி",
  roomNumber: "அறை எண்",
  lastName: "குடும்பப் பெயர்",
  scanInstructions: "இணைக்க, கேமராவைத் திறந்து QR குறியீட்டை ஸ்கேன் செய்யுங்கள்.",
  agreeTerms: "சேவை விதிமுறைகளையும் தனியுரிமைக் கொள்கையையும் ஏற்கிறேன்",
  securityTipLabel: "பாதுகாப்பாக இருங்கள்",
  securityTipBody: "உங்கள் OTP அல்லது கடவுச்சொல்லை யாருடனும், இட ஊழியர்களுடன் கூட, பகிர வேண்டாம்.",
  connectedTitle: "இணைந்துவிட்டீர்கள்",
  connectedSubtitle: "இந்தச் சாதனத்தில் அதிவேக இணையம் இப்போது இயங்குகிறது.",
  logout: "துண்டி",
  continue: "உலாவலைத் தொடர்",
  authFailed: "உங்களை நுழைய வைக்க முடியவில்லை",
  retry: "மீண்டும் முயலுங்கள்",
  contactSupport: "ஆதரவைத் தொடர்பு கொள்ளுங்கள்",
  sessionRemaining: "மீதமுள்ள நேரம்",
  dataUsage: "தரவுப் பயன்பாடு",
  device: "சாதனம்",
  sessionExpired: "உங்கள் அமர்வு முடிந்துவிட்டது",
  reconnect: "மீண்டும் இணை",
  extend: "அமர்வை நீட்டி",
  redirecting: "விரைவில் திருப்பி விடப்படுகிறீர்கள்…",
  offlineTitle: "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்",
  offlineSubtitle: "உங்கள் WiFi இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
  skipAd: "தவிர்",
  termsTitle: "விதிமுறைகள், தனியுரிமை",
  welcomeCta: "தொடங்குங்கள்",
  language: "மொழி",
  a11y: "அணுகல் வசதி",
  highContrast: "அதிக மாறுபாடு",
  largeText: "பெரிய எழுத்து",
  wifi: "WiFi",
  setPasswordTitle: "அடுத்த முறை குறியீடு வேண்டாமா?",
  setPasswordSubtitle:
    "இப்போது ஒரு கடவுச்சொல்லைச் சேமியுங்கள்; அடுத்த முறை உங்கள் எண்ணால் மட்டுமே நுழையலாம்.",
  newPassword: "புதிய கடவுச்சொல்",
  confirmPassword: "கடவுச்சொல்லை உறுதிப்படுத்து",
  savePassword: "கடவுச்சொல்லைச் சேமி",
  skipForNow: "இப்போதைக்கு வேண்டாம்",
  passwordSaved: "கடவுச்சொல் சேமிக்கப்பட்டது -- அடுத்த முறை இதை வைத்து நுழையலாம்.",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "ஒரு சிறு கேள்வி",
  sponsored: "விளம்பரம்",
  submitting: "சமர்ப்பிக்கிறது…",
  sponsorMessage: "ஒரு விளம்பரதாரர் உங்களுக்கு ஒரு செய்தி வைத்திருக்கிறார்.",
  continueCta: "தொடர்",
  answerPlaceholder: "உங்கள் பதிலை எழுதுங்கள்…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "இப்போது மூடியுள்ளது",
  closedSubtitle: "நாங்கள் இப்போது மூடியுள்ளோம். இணைக்க, வேலை நேரத்தில் மீண்டும் முயலுங்கள்.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "நீங்கள் ஏற்கெனவே இந்தக் குழுவில் உள்ளீர்கள்.",
  teamJoined: "குழுவில் சேர்ந்துவிட்டீர்கள்!",
  joinTeam: "குழுவில் சேர்",
  teamPageTitle: "குழுவில் சேருங்கள்",
  teamPageSubtitle: "உங்கள் குழு ஏற்பாட்டாளர் பகிர்ந்த குழுக் குறியீட்டை உள்ளிடுங்கள்.",
  teamJoinedHelper:
    "உங்கள் இணைப்பு பாதிக்கப்படாது -- இது உங்களை உங்கள் குழுவுடன் சேர்த்து வைப்பது மட்டுமே.",
  backToConnection: "என் இணைப்புக்குத் திரும்ப",
  teamCodeLabel: "குழுக் குறியீடு",
  teamCodePlaceholder: "எ.கா. AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "விருந்தினர் WiFi",
  guestNetwork: "விருந்தினர் நெட்வொர்க்",
  brandHeadlineBase: "வேகமான, பாதுகாப்பான WiFi",
  courtesyOfTemplate: ", {venue} வழங்குகிறது",
  verifyDeviceCta: "இணைய, வலதுபுறத்தில் உங்கள் சாதனத்தைச் சரிபார்க்கவும்.",
  supportAskStaff: "ஆதரவு: இட ஊழியரிடம் கேளுங்கள்",
  poweredByWyfy: "இயக்குவது Wyfy Guest",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue}-க்கு வரவேற்கிறோம்",
  welcomeBare: "வரவேற்கிறோம்",
  signInSubtext: "இந்த நெட்வொர்க்கில் இலவச WiFi அணுகலுக்கு நுழையுங்கள்.",
  verifyingCode: "உங்கள் குறியீடு சரிபார்க்கப்படுகிறது…",
  signingIn: "உங்களை நுழைய வைக்கிறோம்…",
  noMethodsAvailable: "நுழைவு முறைகள் எதுவும் இல்லை. வரவேற்பைத் தொடர்பு கொள்ளுங்கள்.",
  agreeToThe: "நான் ஏற்கிறேன்:",
  termsAcceptableUsePolicy: "விதிமுறைகள், ஏற்கத்தக்க பயன்பாட்டுக் கொள்கை",
  dataConsentLabel:
    "எனது தொலைபேசி/மின்னஞ்சல், சாதனம் மற்றும் அமர்வு விவரங்கள் சேகரிக்கப்படுவதற்கு நான் ஒப்புக்கொள்கிறேன் —",
  dataConsentLearnMore: "விவரங்களைப் பார்க்க",
  otpTabSms: "SMS-இல் அனுப்பு",
  otpTabEmail: "மின்னஞ்சலில் அனுப்பு",
  otpTabWhatsapp: "WhatsApp-இல் அனுப்பு",
  haveAPassword: "என்னிடம் கடவுச்சொல் உள்ளது",
  tellUsAboutYourself: "இணைந்துவிட்டீர்கள்! உங்களைப் பற்றிக் கொஞ்சம் சொல்லுங்கள்",
  optionalLabel: "(விருப்பம்)",
  nameLabel: "பெயர்",
  savingLabel: "சேமிக்கிறது…",
  whatsappNumberLabel: "WhatsApp எண்",
  sendingLabel: "அனுப்புகிறது…",
  sentCodeToPrefix: "6 இலக்கக் குறியீட்டை அனுப்பியுள்ளோம்:",
  verifyingLabel: "சரிபார்க்கிறது…",
  verifyOtpConnect: "OTP சரிபார்த்து இணை",
  resendAvailableInTemplate: "{n} வினாடியில் மீண்டும் அனுப்பலாம்",
  changeNumberLabel: "எண்ணை மாற்று",
  mobileOrEmailLabel: "மொபைல் எண் அல்லது மின்னஞ்சல்",
  signingInLabel: "நுழைகிறது…",
  signInConnect: "நுழைந்து இணை",
  forgotUseOtp: "மறந்துவிட்டதா? OTP பயன்படுத்துங்கள்",
  voucherFallbackPrefix: "இந்த இடம் வவுச்சர் குறியீட்டால் விருந்தினரை நுழைய வைக்கிறது --",
  redeemVoucherLink: "உங்களுடையதை இங்கே பயன்படுத்துங்கள்",
  otherWaysToSignIn: "நுழைய வேறு வழிகள்",
  useMobileInstead: "மாற்றாக மொபைல் எண்ணைப் பயன்படுத்துங்கள்",
  useEmailInstead: "மாற்றாக மின்னஞ்சலைப் பயன்படுத்துங்கள்",
  useWhatsappInstead: "மாற்றாக WhatsApp-ஐப் பயன்படுத்துங்கள்",
  haveVoucherUseInstead: "வவுச்சர் குறியீடு உள்ளதா? அதைப் பயன்படுத்துங்கள்",
  savedPasswordsNote: "முதல் OTP நுழைவுக்குப் பிறகுதான் சேமித்த கடவுச்சொல் அமைக்கப்படும்.",
  errValidWhatsapp: "சரியான WhatsApp எண்ணை உள்ளிடுங்கள்",
  errValidMobile: "சரியான மொபைல் எண்ணை உள்ளிடுங்கள்",
  errValidEmail: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடுங்கள்",
  errEnterCode: "6 இலக்கக் குறியீட்டை உள்ளிடுங்கள்",
  errAcceptTerms: "தொடர, விதிமுறைகளையும் ஏற்கத்தக்க பயன்பாட்டுக் கொள்கையையும் ஏற்கவும்.",
  errAcceptDataConsent: "தொடர, மேலே உள்ள தரவு சேகரிப்புக்கு ஒப்புதல் தரவும்.",
  errPhoneEmailPassword: "உங்கள் தொலைபேசி/மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடுங்கள்",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது.",
  successStuckNotice:
    "இன்னும் முயற்சிக்கிறோம் -- காத்திருக்கலாம், அல்லது மீண்டும் நுழைந்து பாருங்கள்.",
  signInAgainLink: "மீண்டும் நுழையுங்கள்",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "வேறு வழியில் குறியீடு பெறுங்கள்",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "உங்களைப் பற்றிக் கொஞ்சம் சொல்லுங்கள்",
  profileNudgeSubtitle: "விருப்பம் -- அடுத்த முறை இட ஊழியர் உங்களை அடையாளம் காண உதவும்.",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "நாட்டுக் குறியீடு",
  otpCodeLabel: "6 இலக்கக் குறியீடு",
  otpCodeHint: "நாங்கள் அனுப்பிய 6 இலக்கக் குறியீட்டை உள்ளிடுங்கள்.",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "பின்செல்",
  authMethodSubtitle: "இணையத்தில் இணைய கீழுள்ள படிவத்தை நிரப்புங்கள்.",
  verifyTitle: "உங்கள் குறியீட்டை உள்ளிடுங்கள்",
  connectingTitle: "உங்களை இணையத்துடன் இணைக்கிறோம்…",
  connectingSubtitle: "சில நொடிகள்.",
  expiredSubtitle: "நெட்வொர்க்கிலிருந்து துண்டிக்கப்பட்டீர்கள்.",
  expiredHelp: "விருந்தினர் WiFi-ஐ தொடர்ந்து பயன்படுத்த மீண்டும் நுழையுங்கள்.",
  useOtpInsteadLabel: "மாற்றாக OTP பயன்படுத்துங்கள்",
  failureSubtitle: "உங்கள் விவரங்களைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
  failureHelp: "சிக்கல் தொடர்ந்தால் இட ஊழியரிடம் கேளுங்கள்.",
  offlineHelp:
    "இங்குள்ள விருந்தினர் WiFi நெட்வொர்க்குடன் இணைந்துள்ளீர்களா என்று பார்த்து, மீண்டும் முயலுங்கள்.",
  redirectNoticeTemplate: "விரைவில் {host}-க்கு அனுப்பப்படுவீர்கள்.",
  redirectCountdownTemplate: "{n} நொடியில் தொடர்கிறோம்",
  continueNowLabel: "இப்போதே தொடர்",
  unknownMethodLabel: "அறியாத நுழைவு முறை.",
  usePasswordInstead: "மாற்றாக சேமித்த கடவுச்சொல்லால் நுழையுங்கள்",
  termsReadFullDocument: "முழு ஆவணத்தைப் படியுங்கள்",
  termsQuestionsAskStaff:
    "இந்த நெட்வொர்க் அல்லது உங்கள் தரவு பற்றி கேள்விகளா? இட ஊழியரிடம் கேளுங்கள்.",
  termsBackToSignIn: "நுழைவுக்குத் திரும்ப",
  nudgeSetPasswordTitle: "அடுத்த முறைக்கு கடவுச்சொல் அமையுங்கள்",
  nudgeSetPasswordSubtitle: "அடுத்த வருகையில் குறியீடு தேவையில்லை",
  nudgeTeamTitle: "குழு குறியீடு உள்ளதா?",
  nudgeTeamSubtitle: "உங்கள் குழுவின் பகிர்ந்த தரவு மற்றும் ஒதுக்கீட்டில் சேருங்கள்",
  noExpiryLabel: "காலக்கெடு இல்லை",
  ipUnknownLabel: "IP தெரியவில்லை",
  disconnectingLabel: "துண்டிக்கிறோம்…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "படி {n} / {total}",
  whyWeAskMobile: "உங்கள் ஒருமுறை உள்நுழைவுக் குறியீட்டை இந்த எண்ணுக்கு SMS-இல் அனுப்புகிறோம்.",
  whyWeAskWhatsapp: "உங்கள் ஒருமுறை உள்நுழைவுக் குறியீட்டை இந்த WhatsApp எண்ணுக்கு அனுப்புகிறோம்.",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Gujarati (gu).
const GU: Dict = {
  loading: "તમારું connection તૈયાર થાય છે…",
  connect: "Connect કરો",
  learnMore: "વધુ જાણો",
  chooseMethod: "Sign in કરવાની રીત પસંદ કરો",
  mobileOtp: "મોબાઇલ પર OTP",
  emailOtp: "Email પર OTP",
  whatsappOtp: "WhatsApp પર OTP",
  passwordLogin: "પાસવર્ડ",
  passwordLoginDesc: "તમારા સેવ કરેલા પાસવર્ડથી sign in કરો",
  voucher: "Voucher કોડ",
  pms: "રૂમ login",
  social: "સોશિયલ login",
  qr: "QR થી sign in",
  clickThrough: "એક-ટૅપ access",
  mobileNumber: "મોબાઇલ નંબર",
  emailAddress: "Email સરનામું",
  password: "પાસવર્ડ",
  signIn: "Sign in કરો",
  sendOtp: "કોડ મોકલો",
  verifyOtp: "ચકાસો",
  resend: "કોડ ફરી મોકલો",
  changeNumber: "ઠેકાણું બદલો",
  voucherCode: "Voucher કોડ",
  submit: "સબમિટ કરો",
  roomNumber: "રૂમ નંબર",
  lastName: "અટક",
  scanInstructions: "Connect કરવા તમારો કૅમેરા ખોલી QR કોડ સ્કૅન કરો.",
  agreeTerms: "હું સેવાની શરતો અને ગોપનીયતા નીતિ સાથે સંમત છું",
  securityTipLabel: "સુરક્ષિત રહો",
  securityTipBody: "તમારો OTP અથવા પાસવર્ડ કોઈની સાથે શેર ન કરો, વેન્યુ સ્ટાફ સાથે પણ નહીં.",
  connectedTitle: "તમે connect થઈ ગયા",
  connectedSubtitle: "આ device પર હવે હાઈ-સ્પીડ internet ચાલુ છે.",
  logout: "Disconnect કરો",
  continue: "Browsing ચાલુ રાખો",
  authFailed: "અમે તમને sign in કરી શક્યા નહીં",
  retry: "ફરી પ્રયત્ન કરો",
  contactSupport: "Support નો સંપર્ક કરો",
  sessionRemaining: "બાકી સમય",
  dataUsage: "Data વપરાશ",
  device: "તમારું device",
  sessionExpired: "તમારું session પૂરું થયું",
  reconnect: "ફરી connect કરો",
  extend: "Session વધારો",
  redirecting: "તમને હમણાં redirect કરીએ છીએ…",
  offlineTitle: "તમે offline છો",
  offlineSubtitle: "તમારું WiFi connection તપાસીને ફરી પ્રયત્ન કરો.",
  skipAd: "છોડો",
  termsTitle: "શરતો અને ગોપનીયતા",
  welcomeCta: "શરૂ કરો",
  language: "ભાષા",
  a11y: "સુલભતા",
  highContrast: "વધુ contrast",
  largeText: "મોટું લખાણ",
  wifi: "WiFi",
  setPasswordTitle: "આવતી વખતે કોડ છોડવો છે?",
  setPasswordSubtitle: "અત્યારે પાસવર્ડ સેવ કરો, પછી માત્ર તમારા નંબરથી sign in કરો.",
  newPassword: "નવો પાસવર્ડ",
  confirmPassword: "પાસવર્ડ ફરી લખો",
  savePassword: "પાસવર્ડ સેવ કરો",
  skipForNow: "અત્યારે રહેવા દો",
  passwordSaved: "પાસવર્ડ સેવ થયો -- આવતી વખતે એનાથી sign in કરી શકશો.",

  // Closes CampaignOverlay.tsx's bypass-of-translate() gap.
  surveyQuestion: "ટૂંકો સવાલ",
  sponsored: "પ્રાયોજિત",
  submitting: "સબમિટ થાય છે…",
  sponsorMessage: "એક પ્રાયોજકનો તમારા માટે સંદેશ છે.",
  continueCta: "ચાલુ રાખો",
  answerPlaceholder: "તમારો જવાબ લખો…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "અત્યારે બંધ છે",
  closedSubtitle: "અમે અત્યારે બંધ છીએ. Connect કરવા માટે કામના સમયે ફરી પ્રયત્ન કરો.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "તમે પહેલેથી આ ટીમમાં છો.",
  teamJoined: "તમે ટીમમાં જોડાઈ ગયા!",
  joinTeam: "ટીમમાં જોડાઓ",
  teamPageTitle: "કોઈ ટીમમાં જોડાઓ",
  teamPageSubtitle: "તમારા ગ્રુપના આયોજકે આપેલો ટીમ કોડ નાખો.",
  teamJoinedHelper: "તમારા connection પર કોઈ અસર નથી -- આ માત્ર તમને તમારી ટીમ સાથે જોડે છે.",
  backToConnection: "મારા connection પર પાછા",
  teamCodeLabel: "ટીમ કોડ",
  teamCodePlaceholder: "દા.ત. AB23CD45",

  // Closes PortalShell.tsx's gap (brand fallback + surrounding chrome).
  guestWifiFallback: "ગેસ્ટ WiFi",
  guestNetwork: "ગેસ્ટ network",
  brandHeadlineBase: "ઝડપી, સલામત WiFi",
  courtesyOfTemplate: ", {venue} તરફથી",
  verifyDeviceCta: "Connect થવા માટે જમણી બાજુ તમારું device ચકાસો.",
  supportAskStaff: "Support: અહીંના સ્ટાફને પૂછો",
  poweredByWyfy: "Wyfy Guest પર ચાલે છે",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue} માં આપનું સ્વાગત છે",
  welcomeBare: "સ્વાગત છે",
  signInSubtext: "આ network પર મફત WiFi માટે sign in કરો.",
  verifyingCode: "તમારો કોડ ચકાસાય છે…",
  signingIn: "તમને sign in કરાય છે…",
  noMethodsAvailable: "કોઈ sign-in રીત ઉપલબ્ધ નથી. કૃપા કરીને reception નો સંપર્ક કરો.",
  agreeToThe: "હું સંમત છું",
  termsAcceptableUsePolicy: "શરતો અને વપરાશ નીતિ",
  dataConsentLabel:
    "મારો ફોન/ઇમેઇલ, ડિવાઇસ અને સેશન વિગતો એકત્ર કરવામાં આવે તે માટે હું સંમતિ આપું છું —",
  dataConsentLearnMore: "વિગતો જુઓ",
  otpTabSms: "મને SMS થી કોડ મોકલો",
  otpTabEmail: "મને email થી કોડ મોકલો",
  otpTabWhatsapp: "મને WhatsApp થી કોડ મોકલો",
  haveAPassword: "મારી પાસે પાસવર્ડ છે",
  tellUsAboutYourself: "તમે connect થઈ ગયા! તમારા વિશે થોડું જણાવો",
  optionalLabel: "(મરજિયાત)",
  nameLabel: "નામ",
  savingLabel: "સેવ થાય છે…",
  whatsappNumberLabel: "WhatsApp નંબર",
  sendingLabel: "મોકલાય છે…",
  sentCodeToPrefix: "અમે 6 અંકનો કોડ અહીં મોકલ્યો છે",
  verifyingLabel: "ચકાસાય છે…",
  verifyOtpConnect: "OTP ચકાસો અને connect કરો",
  resendAvailableInTemplate: "{n}s માં ફરી મોકલી શકાશે",
  changeNumberLabel: "નંબર બદલો",
  mobileOrEmailLabel: "મોબાઇલ નંબર કે email",
  signingInLabel: "Sign in થાય છે…",
  signInConnect: "Sign in કરીને connect કરો",
  forgotUseOtp: "ભૂલી ગયા? OTP વાપરો",
  voucherFallbackPrefix: "આ જગ્યાએ મહેમાનો voucher કોડથી sign in કરે છે --",
  redeemVoucherLink: "તમારો voucher અહીં વાપરો",
  otherWaysToSignIn: "Sign in કરવાની બીજી રીતો",
  useMobileInstead: "એના બદલે મોબાઇલ નંબર વાપરો",
  useEmailInstead: "એના બદલે email વાપરો",
  useWhatsappInstead: "એના બદલે WhatsApp વાપરો",
  haveVoucherUseInstead: "Voucher કોડ છે? એ વાપરો",
  savedPasswordsNote: "સેવ કરેલો પાસવર્ડ તમારા પહેલા OTP sign-in પછી તરત જ સેટ થાય છે.",
  errValidWhatsapp: "માન્ય WhatsApp નંબર નાખો",
  errValidMobile: "માન્ય મોબાઇલ નંબર નાખો",
  errValidEmail: "માન્ય email સરનામું નાખો",
  errEnterCode: "6 અંકનો કોડ નાખો",
  errAcceptTerms: "આગળ વધવા માટે શરતો અને વપરાશ નીતિ સ્વીકારો.",
  errAcceptDataConsent: "આગળ વધવા માટે કૃપા કરી ઉપરના ડેટા સંગ્રહ માટે સંમતિ આપો.",
  errPhoneEmailPassword: "તમારો ફોન/email અને પાસવર્ડ નાખો",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "ધાર્યા કરતાં વધુ સમય લાગે છે.",
  successStuckNotice: "હજી કામ ચાલુ છે -- રાહ જુઓ, અથવા ફરી sign in કરો.",
  signInAgainLink: "ફરી sign in કરો",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "કોડ મેળવવાની બીજી રીત",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "તમારા વિશે થોડું જણાવો",
  profileNudgeSubtitle: "મરજિયાત -- આવતી વખતે અહીંના સ્ટાફને તમને ઓળખવામાં મદદ મળે.",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "દેશનો કોડ",
  otpCodeLabel: "6 અંકનો કોડ",
  otpCodeHint: "અમે મોકલેલો 6 અંકનો કોડ નાખો.",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "પાછળ",
  authMethodSubtitle: "Online થવા માટે નીચેનું ફોર્મ ભરો.",
  verifyTitle: "તમારો કોડ નાખો",
  connectingTitle: "તમને ઇન્ટરનેટ સાથે connect કરીએ છીએ…",
  connectingSubtitle: "બસ એક ક્ષણ.",
  expiredSubtitle: "તમે network પરથી disconnect થયા છો.",
  expiredHelp: "Guest WiFi વાપરવાનું ચાલુ રાખવા ફરી sign in કરો.",
  useOtpInsteadLabel: "એના બદલે OTP વાપરો",
  failureSubtitle: "તમારી વિગતો તપાસીને ફરી પ્રયત્ન કરો.",
  failureHelp: "સમસ્યા ચાલુ રહે તો અહીંના સ્ટાફને પૂછો.",
  offlineHelp: "તમે અહીંના guest WiFi network સાથે જોડાયેલા છો કે નહીં તે તપાસીને ફરી પ્રયત્ન કરો.",
  redirectNoticeTemplate: "તમને હમણાં {host} પર મોકલીશું.",
  redirectCountdownTemplate: "{n} સેકંડમાં આગળ વધીએ છીએ",
  continueNowLabel: "હમણાં જ આગળ વધો",
  unknownMethodLabel: "અજાણી sign in રીત.",
  usePasswordInstead: "એના બદલે સેવ કરેલા પાસવર્ડથી sign in કરો",
  termsReadFullDocument: "આખો દસ્તાવેજ વાંચો",
  termsQuestionsAskStaff: "આ network કે તમારા ડેટા વિશે પ્રશ્નો? અહીંના સ્ટાફને પૂછો.",
  termsBackToSignIn: "Sign in પર પાછા જાઓ",
  nudgeSetPasswordTitle: "આગલી વખત માટે પાસવર્ડ સેટ કરો",
  nudgeSetPasswordSubtitle: "આગલી મુલાકાતે કોડની જરૂર નહીં પડે",
  nudgeTeamTitle: "Team કોડ છે?",
  nudgeTeamSubtitle: "તમારા ગ્રુપના શેર કરેલા ડેટા અને ક્વોટામાં જોડાઓ",
  noExpiryLabel: "કોઈ મુદત નથી",
  ipUnknownLabel: "IP અજાણ",
  disconnectingLabel: "Disconnect કરીએ છીએ…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "સ્ટેપ {n} / {total}",
  whyWeAskMobile: "તમારો એક-વખતનો sign-in કોડ અમે આ નંબર પર SMS થી મોકલીએ છીએ.",
  whyWeAskWhatsapp: "તમારો એક-વખતનો sign-in કોડ અમે આ WhatsApp નંબર પર મોકલીએ છીએ.",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Kannada (kn).
const KN: Dict = {
  loading: "ನಿಮ್ಮ connection ಸಿದ್ಧವಾಗುತ್ತಿದೆ…",
  connect: "Connect ಮಾಡಿ",
  learnMore: "ಇನ್ನಷ್ಟು ತಿಳಿಯಿರಿ",
  chooseMethod: "Sign in ಮಾಡುವ ವಿಧಾನ ಆರಿಸಿ",
  mobileOtp: "ಮೊಬೈಲ್ OTP",
  emailOtp: "ಇಮೇಲ್ OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "Password ನಿಂದ login",
  passwordLoginDesc: "ನೀವು save ಮಾಡಿದ password ನಿಂದ sign in ಮಾಡಿ",
  voucher: "Voucher ಕೋಡ್",
  pms: "ಕೋಣೆಯ login",
  social: "Social ಖಾತೆ login",
  qr: "QR ಮೂಲಕ sign in",
  clickThrough: "ಒಂದೇ tap access",
  mobileNumber: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
  emailAddress: "ಇಮೇಲ್ ವಿಳಾಸ",
  password: "ನಿಮ್ಮ password",
  signIn: "Sign in ಮಾಡಿ",
  sendOtp: "ಕೋಡ್ ಕಳಿಸಿ",
  verifyOtp: "ಪರಿಶೀಲಿಸಿ",
  resend: "ಕೋಡ್ ಮತ್ತೆ ಕಳಿಸಿ",
  changeNumber: "ಕಳಿಸುವ ಸ್ಥಳ ಬದಲಿಸಿ",
  voucherCode: "Voucher ಕೋಡ್",
  submit: "ಸಲ್ಲಿಸಿ",
  roomNumber: "ಕೋಣೆ ಸಂಖ್ಯೆ",
  lastName: "ಕೊನೆಯ ಹೆಸರು",
  scanInstructions: "Connect ಆಗಲು camera ತೆರೆದು QR ಕೋಡ್ scan ಮಾಡಿ.",
  agreeTerms: "ಸೇವಾ ನಿಯಮಗಳು ಮತ್ತು ಗೌಪ್ಯತಾ ನೀತಿಗೆ ನಾನು ಒಪ್ಪುತ್ತೇನೆ",
  securityTipLabel: "ಸುರಕ್ಷಿತವಾಗಿರಿ",
  securityTipBody: "ನಿಮ್ಮ OTP ಅಥವಾ password ಅನ್ನು ಯಾರೊಂದಿಗೂ, ವೆನ್ಯೂ ಸಿಬ್ಬಂದಿಯೊಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.",
  connectedTitle: "ನೀವು connect ಆಗಿದ್ದೀರಿ",
  connectedSubtitle: "ಈ device ನಲ್ಲಿ ಈಗ high-speed internet ಚಾಲ್ತಿಯಲ್ಲಿದೆ.",
  logout: "Disconnect ಮಾಡಿ",
  continue: "Browsing ಮುಂದುವರಿಸಿ",
  authFailed: "ನಿಮ್ಮನ್ನು sign in ಮಾಡಲು ಆಗಲಿಲ್ಲ",
  retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
  contactSupport: "Support ಸಂಪರ್ಕಿಸಿ",
  sessionRemaining: "ಉಳಿದ ಸಮಯ",
  dataUsage: "Data ಬಳಕೆ",
  device: "ನಿಮ್ಮ device",
  sessionExpired: "ನಿಮ್ಮ session ಮುಗಿದಿದೆ",
  reconnect: "ಮತ್ತೆ connect ಆಗಿ",
  extend: "Session ವಿಸ್ತರಿಸಿ",
  redirecting: "ಸ್ವಲ್ಪದರಲ್ಲೇ ನಿಮ್ಮನ್ನು ಕಳಿಸಲಾಗುತ್ತದೆ…",
  offlineTitle: "ನೀವು offline ಇದ್ದೀರಿ",
  offlineSubtitle: "ನಿಮ್ಮ WiFi connection ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  skipAd: "ಬಿಟ್ಟುಬಿಡಿ",
  termsTitle: "ನಿಯಮಗಳು ಮತ್ತು ಗೌಪ್ಯತೆ",
  welcomeCta: "ಶುರು ಮಾಡಿ",
  language: "ಭಾಷೆ",
  a11y: "ಸುಲಭ ಬಳಕೆ",
  highContrast: "ಹೆಚ್ಚು contrast",
  largeText: "ದೊಡ್ಡ ಅಕ್ಷರ",
  wifi: "WiFi",
  setPasswordTitle: "ಮುಂದಿನ ಸಲ ಕೋಡ್ ಬೇಡವೇ?",
  setPasswordSubtitle: "ಈಗಲೇ password save ಮಾಡಿ, ಮುಂದಿನ ಸಲ ನಿಮ್ಮ ಸಂಖ್ಯೆಯಿಂದಲೇ sign in ಮಾಡಿ.",
  newPassword: "ಹೊಸ password",
  confirmPassword: "Password ಖಚಿತಪಡಿಸಿ",
  savePassword: "Password save ಮಾಡಿ",
  skipForNow: "ಸದ್ಯಕ್ಕೆ ಬೇಡ",
  passwordSaved: "Password save ಆಯಿತು — ಮುಂದಿನ ಸಲ ಇದರಿಂದಲೇ sign in ಮಾಡಬಹುದು.",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "ಒಂದು ಸಣ್ಣ ಪ್ರಶ್ನೆ",
  sponsored: "ಪ್ರಾಯೋಜಿತ",
  submitting: "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…",
  sponsorMessage: "ಪ್ರಾಯೋಜಕರಿಂದ ನಿಮಗೊಂದು message ಇದೆ.",
  continueCta: "ಮುಂದುವರಿಸಿ",
  answerPlaceholder: "ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "ಸದ್ಯಕ್ಕೆ ಮುಚ್ಚಿದೆ",
  closedSubtitle: "ನಾವು ಸದ್ಯಕ್ಕೆ ಮುಚ್ಚಿದ್ದೇವೆ. Connect ಆಗಲು ಕೆಲಸದ ಹೊತ್ತಿನಲ್ಲಿ ಮತ್ತೆ ಬನ್ನಿ.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "ನೀವು ಈಗಾಗಲೇ ಈ ತಂಡದಲ್ಲಿ ಇದ್ದೀರಿ.",
  teamJoined: "ನೀವು ತಂಡಕ್ಕೆ ಸೇರಿದ್ದೀರಿ!",
  joinTeam: "ತಂಡಕ್ಕೆ ಸೇರಿ",
  teamPageTitle: "ತಂಡಕ್ಕೆ ಸೇರಿಕೊಳ್ಳಿ",
  teamPageSubtitle: "ನಿಮ್ಮ group organizer ಕೊಟ್ಟ ತಂಡದ ಕೋಡ್ ಬರೆಯಿರಿ.",
  teamJoinedHelper:
    "ನಿಮ್ಮ connection ಗೆ ಏನೂ ಆಗುವುದಿಲ್ಲ — ಇದು ನಿಮ್ಮನ್ನು ನಿಮ್ಮ ತಂಡದ ಜೊತೆ ಸೇರಿಸುತ್ತದೆ ಅಷ್ಟೇ.",
  backToConnection: "ನನ್ನ connection ಗೆ ಹಿಂತಿರುಗಿ",
  teamCodeLabel: "ತಂಡದ ಕೋಡ್",
  teamCodePlaceholder: "ಉದಾ. AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "ಅತಿಥಿ WiFi",
  guestNetwork: "ಅತಿಥಿ network",
  brandHeadlineBase: "ವೇಗದ, ಸುರಕ್ಷಿತ WiFi",
  courtesyOfTemplate: ", {venue} ಅವರ ಸೌಜನ್ಯದಿಂದ",
  verifyDeviceCta: "Connect ಆಗಲು ಬಲಗಡೆ ನಿಮ್ಮ device ಪರಿಶೀಲಿಸಿ.",
  supportAskStaff: "Support: ಇಲ್ಲಿನ staff ಅನ್ನು ಕೇಳಿ",
  poweredByWyfy: "Wyfy Guest ಮೇಲೆ ನಡೆಯುತ್ತದೆ",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue} ಗೆ ಸ್ವಾಗತ",
  welcomeBare: "ಸ್ವಾಗತ",
  signInSubtext: "ಈ network ನಲ್ಲಿ ಉಚಿತ WiFi ಪಡೆಯಲು sign in ಮಾಡಿ.",
  verifyingCode: "ನಿಮ್ಮ ಕೋಡ್ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
  signingIn: "Sign in ಮಾಡಲಾಗುತ್ತಿದೆ…",
  noMethodsAvailable: "ಯಾವ sign-in ವಿಧಾನವೂ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು reception ಸಂಪರ್ಕಿಸಿ.",
  agreeToThe: "ನಾನು ಒಪ್ಪುತ್ತೇನೆ:",
  termsAcceptableUsePolicy: "ನಿಯಮಗಳು ಮತ್ತು ಬಳಕೆಯ ನೀತಿ",
  dataConsentLabel: "ನನ್ನ ಫೋನ್/ಇಮೇಲ್, ಡಿವೈಸ್ ಮತ್ತು ಸೆಷನ್ ವಿವರಗಳನ್ನು ಸಂಗ್ರಹಿಸಲು ನಾನು ಒಪ್ಪುತ್ತೇನೆ —",
  dataConsentLearnMore: "ವಿವರಗಳನ್ನು ನೋಡಿ",
  otpTabSms: "SMS ನಲ್ಲಿ ಕೋಡ್ ಕಳಿಸಿ",
  otpTabEmail: "ಇಮೇಲ್‌ನಲ್ಲಿ ಕೋಡ್ ಕಳಿಸಿ",
  otpTabWhatsapp: "WhatsApp ನಲ್ಲಿ ಕೋಡ್ ಕಳಿಸಿ",
  haveAPassword: "ನನ್ನ ಬಳಿ password ಇದೆ",
  tellUsAboutYourself: "ನೀವು connect ಆಗಿದ್ದೀರಿ! ನಿಮ್ಮ ಬಗ್ಗೆ ಸ್ವಲ್ಪ ಹೇಳಿ",
  optionalLabel: "(ಐಚ್ಛಿಕ)",
  nameLabel: "ಹೆಸರು",
  savingLabel: "Save ಆಗುತ್ತಿದೆ…",
  whatsappNumberLabel: "WhatsApp ಸಂಖ್ಯೆ",
  sendingLabel: "ಕಳಿಸಲಾಗುತ್ತಿದೆ…",
  sentCodeToPrefix: "6 ಅಂಕಿಯ ಕೋಡ್ ಇಲ್ಲಿಗೆ ಕಳಿಸಿದ್ದೇವೆ:",
  verifyingLabel: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
  verifyOtpConnect: "OTP ಪರಿಶೀಲಿಸಿ, connect ಆಗಿ",
  resendAvailableInTemplate: "{n}s ನಂತರ ಮತ್ತೆ ಕಳಿಸಬಹುದು",
  changeNumberLabel: "ಸಂಖ್ಯೆ ಬದಲಿಸಿ",
  mobileOrEmailLabel: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಥವಾ ಇಮೇಲ್",
  signingInLabel: "Sign in ಆಗುತ್ತಿದೆ…",
  signInConnect: "Sign in ಮಾಡಿ, connect ಆಗಿ",
  forgotUseOtp: "ಮರೆತಿರಾ? OTP ಬಳಸಿ",
  voucherFallbackPrefix: "ಈ location ನಲ್ಲಿ sign in ಆಗಲು voucher ಕೋಡ್ ಬೇಕು —",
  redeemVoucherLink: "ನಿಮ್ಮದನ್ನು ಇಲ್ಲಿ ಬಳಸಿ",
  otherWaysToSignIn: "Sign in ಮಾಡುವ ಬೇರೆ ದಾರಿಗಳು",
  useMobileInstead: "ಬದಲಿಗೆ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಬಳಸಿ",
  useEmailInstead: "ಬದಲಿಗೆ ಇಮೇಲ್ ಬಳಸಿ",
  useWhatsappInstead: "ಬದಲಿಗೆ WhatsApp ಬಳಸಿ",
  haveVoucherUseInstead: "Voucher ಕೋಡ್ ಇದೆಯೇ? ಬದಲಿಗೆ ಅದನ್ನು ಬಳಸಿ",
  savedPasswordsNote: "ಮೊದಲ ಸಲ OTP ಯಿಂದ sign in ಆದ ತಕ್ಷಣವೇ password save ಮಾಡಿಕೊಳ್ಳಬಹುದು.",
  errValidWhatsapp: "ಸರಿಯಾದ WhatsApp ಸಂಖ್ಯೆ ಬರೆಯಿರಿ",
  errValidMobile: "ಸರಿಯಾದ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ",
  errValidEmail: "ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸ ಬರೆಯಿರಿ",
  errEnterCode: "6 ಅಂಕಿಯ ಕೋಡ್ ಬರೆಯಿರಿ",
  errAcceptTerms: "ಮುಂದುವರಿಯಲು ದಯವಿಟ್ಟು ನಿಯಮಗಳು ಮತ್ತು ಬಳಕೆಯ ನೀತಿ ಒಪ್ಪಿಕೊಳ್ಳಿ.",
  errAcceptDataConsent: "ಮುಂದುವರಿಯಲು ದಯವಿಟ್ಟು ಮೇಲಿನ ಡೇಟಾ ಸಂಗ್ರಹಣೆಗೆ ಒಪ್ಪಿಗೆ ನೀಡಿ.",
  errPhoneEmailPassword: "ನಿಮ್ಮ ಫೋನ್/ಇಮೇಲ್ ಮತ್ತು password ಬರೆಯಿರಿ",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಹೊತ್ತು ಆಗುತ್ತಿದೆ.",
  successStuckNotice: "ಇನ್ನೂ ಪ್ರಯತ್ನ ನಡೆಯುತ್ತಿದೆ — ಕಾಯಬಹುದು, ಅಥವಾ ಮತ್ತೆ sign in ಮಾಡಿ ನೋಡಬಹುದು.",
  signInAgainLink: "ಮತ್ತೆ sign in ಮಾಡಿ",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "ಕೋಡ್ ಬೇರೆ ದಾರಿಯಲ್ಲಿ ಪಡೆಯಿರಿ",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "ನಿಮ್ಮ ಬಗ್ಗೆ ಸ್ವಲ್ಪ ಹೇಳಿ",
  profileNudgeSubtitle: "ಐಚ್ಛಿಕ — ಮುಂದಿನ ಸಲ ಇಲ್ಲಿನ staff ನಿಮ್ಮನ್ನು ಗುರುತಿಸಲು ಸಹಾಯವಾಗುತ್ತದೆ.",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "ದೇಶದ ಕೋಡ್",
  otpCodeLabel: "6 ಅಂಕಿಯ ಕೋಡ್",
  otpCodeHint: "ನಾವು ಕಳಿಸಿದ 6 ಅಂಕಿಯ ಕೋಡ್ ಬರೆಯಿರಿ.",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "ಹಿಂದೆ",
  authMethodSubtitle: "Online ಆಗಲು ಕೆಳಗಿನ ಫಾರ್ಮ್ ಭರ್ತಿ ಮಾಡಿ.",
  verifyTitle: "ನಿಮ್ಮ ಕೋಡ್ ನಮೂದಿಸಿ",
  connectingTitle: "ನಿಮ್ಮನ್ನು ಇಂಟರ್ನೆಟ್‌ಗೆ connect ಮಾಡುತ್ತಿದ್ದೇವೆ…",
  connectingSubtitle: "ಒಂದು ಕ್ಷಣ.",
  expiredSubtitle: "ನಿಮ್ಮನ್ನು network ನಿಂದ disconnect ಮಾಡಲಾಗಿದೆ.",
  expiredHelp: "Guest WiFi ಬಳಕೆ ಮುಂದುವರಿಸಲು ಮತ್ತೆ sign in ಮಾಡಿ.",
  useOtpInsteadLabel: "ಬದಲಿಗೆ OTP ಬಳಸಿ",
  failureSubtitle: "ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  failureHelp: "ಸಮಸ್ಯೆ ಮುಂದುವರಿದರೆ ಇಲ್ಲಿನ staff ಅನ್ನು ಕೇಳಿ.",
  offlineHelp: "ನೀವು ಇಲ್ಲಿನ guest WiFi network ಗೆ ಸೇರಿದ್ದೀರಾ ಎಂದು ನೋಡಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  redirectNoticeTemplate: "ಸ್ವಲ್ಪದರಲ್ಲೇ ನಿಮ್ಮನ್ನು {host} ಗೆ ಕಳಿಸಲಾಗುತ್ತದೆ.",
  redirectCountdownTemplate: "{n} ಸೆಕೆಂಡಿನಲ್ಲಿ ಮುಂದುವರಿಯುತ್ತೇವೆ",
  continueNowLabel: "ಈಗಲೇ ಮುಂದುವರಿಸಿ",
  unknownMethodLabel: "ಗೊತ್ತಿಲ್ಲದ sign in ವಿಧಾನ.",
  usePasswordInstead: "ಬದಲಿಗೆ ಸೇವ್ ಮಾಡಿದ ಪಾಸ್‌ವರ್ಡ್‌ನಿಂದ sign in ಮಾಡಿ",
  termsReadFullDocument: "ಪೂರ್ಣ ದಾಖಲೆ ಓದಿ",
  termsQuestionsAskStaff:
    "ಈ network ಅಥವಾ ನಿಮ್ಮ ಡೇಟಾ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳಿವೆಯೇ? ಇಲ್ಲಿನ staff ಅನ್ನು ಕೇಳಿ.",
  termsBackToSignIn: "Sign in ಗೆ ಹಿಂತಿರುಗಿ",
  nudgeSetPasswordTitle: "ಮುಂದಿನ ಬಾರಿಗೆ ಪಾಸ್‌ವರ್ಡ್ ಸೆಟ್ ಮಾಡಿ",
  nudgeSetPasswordSubtitle: "ಮುಂದಿನ ಭೇಟಿಯಲ್ಲಿ ಕೋಡ್ ಬೇಕಿಲ್ಲ",
  nudgeTeamTitle: "Team ಕೋಡ್ ಇದೆಯೇ?",
  nudgeTeamSubtitle: "ನಿಮ್ಮ ಗುಂಪಿನ ಹಂಚಿದ ಡೇಟಾ ಮತ್ತು ಕೋಟಾಗೆ ಸೇರಿ",
  noExpiryLabel: "ಅವಧಿ ಇಲ್ಲ",
  ipUnknownLabel: "IP ಗೊತ್ತಿಲ್ಲ",
  disconnectingLabel: "Disconnect ಮಾಡುತ್ತಿದ್ದೇವೆ…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "ಹಂತ {n} / {total}",
  whyWeAskMobile: "ನಿಮ್ಮ ಒಂದು ಬಾರಿಯ sign-in ಕೋಡ್ ಅನ್ನು ಈ ಸಂಖ್ಯೆಗೆ SMS ನಲ್ಲಿ ಕಳಿಸುತ್ತೇವೆ.",
  whyWeAskWhatsapp: "ನಿಮ್ಮ ಒಂದು ಬಾರಿಯ sign-in ಕೋಡ್ ಅನ್ನು ಈ WhatsApp ಸಂಖ್ಯೆಗೆ ಕಳಿಸುತ್ತೇವೆ.",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Malayalam (ml).
const ML: Dict = {
  loading: "നിങ്ങളുടെ കണക്ഷൻ ഒരുക്കുന്നു…",
  connect: "കണക്ട് ചെയ്യൂ",
  learnMore: "കൂടുതൽ അറിയൂ",
  chooseMethod: "sign-in രീതി തിരഞ്ഞെടുക്കൂ",
  mobileOtp: "മൊബൈൽ OTP",
  emailOtp: "ഇമെയിൽ OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "password വഴി",
  passwordLoginDesc: "സേവ് ചെയ്ത password ഉപയോഗിച്ച് sign in ചെയ്യൂ",
  voucher: "voucher കോഡ്",
  pms: "മുറി login",
  social: "സോഷ്യൽ login",
  qr: "QR വഴി sign-in",
  clickThrough: "ഒറ്റ ടാപ്പിൽ കണക്ട്",
  mobileNumber: "മൊബൈൽ നമ്പർ",
  emailAddress: "ഇമെയിൽ വിലാസം",
  password: "നിങ്ങളുടെ password",
  signIn: "sign in ചെയ്യൂ",
  sendOtp: "കോഡ് അയയ്ക്കൂ",
  verifyOtp: "പരിശോധിക്കൂ",
  resend: "കോഡ് വീണ്ടും അയയ്ക്കൂ",
  changeNumber: "വിലാസം മാറ്റൂ",
  voucherCode: "voucher കോഡ്",
  submit: "സമർപ്പിക്കൂ",
  roomNumber: "മുറി നമ്പർ",
  lastName: "കുടുംബപ്പേര്",
  scanInstructions: "കണക്ട് ചെയ്യാൻ ക്യാമറ തുറന്ന് QR കോഡ് സ്കാൻ ചെയ്യൂ.",
  agreeTerms: "സേവന നിബന്ധനകളും സ്വകാര്യതാ നയവും ഞാൻ അംഗീകരിക്കുന്നു",
  securityTipLabel: "സുരക്ഷിതരായിരിക്കുക",
  securityTipBody:
    "നിങ്ങളുടെ OTP അല്ലെങ്കിൽ password ആരുമായും, വേദി സ്റ്റാഫുമായി പോലും, പങ്കിടരുത്.",
  connectedTitle: "നിങ്ങൾ കണക്ട് ആയി",
  connectedSubtitle: "ഈ ഉപകരണത്തിൽ ഇപ്പോൾ അതിവേഗ ഇന്റർനെറ്റ് ലഭ്യമാണ്.",
  logout: "ഡിസ്കണക്ട് ചെയ്യൂ",
  continue: "ബ്രൗസിംഗ് തുടരൂ",
  authFailed: "നിങ്ങളെ sign in ചെയ്യിക്കാനായില്ല",
  retry: "വീണ്ടും ശ്രമിക്കൂ",
  contactSupport: "support-നെ ബന്ധപ്പെടൂ",
  sessionRemaining: "ബാക്കി സമയം",
  dataUsage: "ഡാറ്റ ഉപയോഗം",
  device: "ഉപകരണം",
  sessionExpired: "നിങ്ങളുടെ സെഷൻ അവസാനിച്ചു",
  reconnect: "വീണ്ടും കണക്ട് ചെയ്യൂ",
  extend: "സെഷൻ നീട്ടൂ",
  redirecting: "ഉടൻ നിങ്ങളെ തിരിച്ചുവിടുന്നു…",
  offlineTitle: "നിങ്ങൾ ഓഫ്‌ലൈനാണ്",
  offlineSubtitle: "WiFi കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കൂ.",
  skipAd: "ഒഴിവാക്കൂ",
  termsTitle: "നിബന്ധനകളും സ്വകാര്യതയും",
  welcomeCta: "തുടങ്ങൂ",
  language: "ഭാഷ",
  a11y: "പ്രാപ്യത",
  highContrast: "ഉയർന്ന കോൺട്രാസ്റ്റ്",
  largeText: "വലിയ അക്ഷരങ്ങൾ",
  wifi: "WiFi",
  setPasswordTitle: "അടുത്ത തവണ കോഡ് വേണ്ടേ?",
  setPasswordSubtitle: "ഇപ്പോൾ ഒരു password സേവ് ചെയ്യൂ, അടുത്ത തവണ നമ്പർ മാത്രം മതി.",
  newPassword: "പുതിയ password",
  confirmPassword: "password വീണ്ടും നൽകൂ",
  savePassword: "password സേവ് ചെയ്യൂ",
  skipForNow: "ഇപ്പോൾ വേണ്ട",
  passwordSaved: "password സേവ് ചെയ്തു -- അടുത്ത തവണ ഇത് ഉപയോഗിച്ച് sign in ചെയ്യാം.",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "ഒരു ചെറിയ ചോദ്യം",
  sponsored: "സ്പോൺസർ ചെയ്തത്",
  submitting: "സമർപ്പിക്കുന്നു…",
  sponsorMessage: "ഒരു സ്പോൺസർക്ക് നിങ്ങളോട് ഒരു സന്ദേശമുണ്ട്.",
  continueCta: "തുടരൂ",
  answerPlaceholder: "ഉത്തരം ടൈപ്പ് ചെയ്യൂ…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "ഇപ്പോൾ അടച്ചിരിക്കുന്നു",
  closedSubtitle: "ഞങ്ങൾ ഇപ്പോൾ അടച്ചിരിക്കുന്നു. കണക്ട് ചെയ്യാൻ പ്രവൃത്തി സമയത്ത് വീണ്ടും വരൂ.",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "നിങ്ങൾ ഇതിനകം ഈ ടീമിൽ ഉണ്ട്.",
  teamJoined: "നിങ്ങൾ ടീമിൽ ചേർന്നു!",
  joinTeam: "ടീമിൽ ചേരൂ",
  teamPageTitle: "ഒരു ടീമിൽ ചേരൂ",
  teamPageSubtitle: "നിങ്ങളുടെ ഗ്രൂപ്പ് സംഘാടകൻ നൽകിയ ടീം കോഡ് നൽകൂ.",
  teamJoinedHelper:
    "നിങ്ങളുടെ കണക്ഷനെ ഇത് ബാധിക്കില്ല -- നിങ്ങളെ ടീമിനൊപ്പം ചേർത്തുവെക്കുക മാത്രമേ ചെയ്യൂ.",
  backToConnection: "എന്റെ കണക്ഷനിലേക്ക് മടങ്ങൂ",
  teamCodeLabel: "ടീം കോഡ്",
  teamCodePlaceholder: "ഉദാ. AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "അതിഥി WiFi",
  guestNetwork: "അതിഥി നെറ്റ്‌വർക്ക്",
  brandHeadlineBase: "വേഗമേറിയ, സുരക്ഷിത WiFi",
  courtesyOfTemplate: ", {venue} ഒരുക്കുന്നത്",
  verifyDeviceCta: "കണക്ട് ആകാൻ വലതുവശത്ത് നിങ്ങളുടെ ഉപകരണം പരിശോധിക്കൂ.",
  supportAskStaff: "സഹായം: സ്ഥാപനത്തിലെ ജീവനക്കാരോട് ചോദിക്കൂ",
  poweredByWyfy: "Wyfy Guest-ൽ പ്രവർത്തിക്കുന്നു",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue}-ലേക്ക് സ്വാഗതം",
  welcomeBare: "സ്വാഗതം",
  signInSubtext: "ഈ നെറ്റ്‌വർക്കിൽ സൗജന്യ WiFi ലഭിക്കാൻ sign in ചെയ്യൂ.",
  verifyingCode: "നിങ്ങളുടെ കോഡ് പരിശോധിക്കുന്നു…",
  signingIn: "നിങ്ങളെ sign in ചെയ്യിക്കുന്നു…",
  noMethodsAvailable: "sign-in രീതികളൊന്നും ലഭ്യമല്ല. ദയവായി റിസപ്ഷനിൽ ബന്ധപ്പെടൂ.",
  agreeToThe: "ഞാൻ അംഗീകരിക്കുന്നു",
  termsAcceptableUsePolicy: "നിബന്ധനകളും ഉപയോഗ നയവും",
  dataConsentLabel: "എന്റെ ഫോൺ/ഇമെയിൽ, ഡിവൈസ്, സെഷൻ വിവരങ്ങൾ ശേഖരിക്കുന്നതിന് ഞാൻ സമ്മതിക്കുന്നു —",
  dataConsentLearnMore: "വിശദാംശങ്ങൾ കാണുക",
  otpTabSms: "SMS-ൽ കോഡ് അയയ്ക്കൂ",
  otpTabEmail: "ഇമെയിലിൽ കോഡ് അയയ്ക്കൂ",
  otpTabWhatsapp: "WhatsApp-ൽ കോഡ് അയയ്ക്കൂ",
  haveAPassword: "എനിക്ക് password ഉണ്ട്",
  tellUsAboutYourself: "നിങ്ങൾ കണക്ട് ആയി! നിങ്ങളെക്കുറിച്ച് അൽപ്പം പറയൂ",
  optionalLabel: "(നിർബന്ധമല്ല)",
  nameLabel: "പേര്",
  savingLabel: "സേവ് ചെയ്യുന്നു…",
  whatsappNumberLabel: "WhatsApp നമ്പർ",
  sendingLabel: "അയയ്ക്കുന്നു…",
  sentCodeToPrefix: "6 അക്ക കോഡ് അയച്ചിരിക്കുന്നത്",
  verifyingLabel: "പരിശോധിക്കുന്നു…",
  verifyOtpConnect: "OTP പരിശോധിച്ച് കണക്ട് ചെയ്യൂ",
  resendAvailableInTemplate: "{n} സെക്കൻഡിൽ വീണ്ടും അയയ്ക്കാം",
  changeNumberLabel: "നമ്പർ മാറ്റൂ",
  mobileOrEmailLabel: "മൊബൈൽ നമ്പർ അല്ലെങ്കിൽ ഇമെയിൽ",
  signingInLabel: "sign in ചെയ്യുന്നു…",
  signInConnect: "sign in ചെയ്ത് കണക്ട് ചെയ്യൂ",
  forgotUseOtp: "മറന്നോ? പകരം OTP ഉപയോഗിക്കൂ",
  voucherFallbackPrefix: "ഈ location അതിഥികളെ sign in ചെയ്യിക്കുന്നത് voucher കോഡ് വഴിയാണ് --",
  redeemVoucherLink: "നിങ്ങളുടേത് ഇവിടെ ഉപയോഗിക്കൂ",
  otherWaysToSignIn: "sign in ചെയ്യാൻ മറ്റു വഴികൾ",
  useMobileInstead: "പകരം മൊബൈൽ നമ്പർ ഉപയോഗിക്കൂ",
  useEmailInstead: "പകരം ഇമെയിൽ ഉപയോഗിക്കൂ",
  useWhatsappInstead: "പകരം WhatsApp ഉപയോഗിക്കൂ",
  haveVoucherUseInstead: "voucher കോഡ് ഉണ്ടോ? പകരം അത് ഉപയോഗിക്കൂ",
  savedPasswordsNote: "ആദ്യ OTP sign-in-ന് തൊട്ടുപിന്നാലെയാണ് password സേവ് ചെയ്യാൻ കഴിയുക.",
  errValidWhatsapp: "ശരിയായ WhatsApp നമ്പർ നൽകൂ",
  errValidMobile: "ശരിയായ മൊബൈൽ നമ്പർ നൽകൂ",
  errValidEmail: "ശരിയായ ഇമെയിൽ വിലാസം നൽകൂ",
  errEnterCode: "6 അക്ക കോഡ് നൽകൂ",
  errAcceptTerms: "തുടരാൻ നിബന്ധനകളും ഉപയോഗ നയവും അംഗീകരിക്കൂ.",
  errAcceptDataConsent: "തുടരാൻ മുകളിലുള്ള ഡാറ്റ ശേഖരണത്തിന് സമ്മതം നൽകുക.",
  errPhoneEmailPassword: "നിങ്ങളുടെ ഫോൺ/ഇമെയിലും password-ഉം നൽകൂ",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "പ്രതീക്ഷിച്ചതിലും സമയമെടുക്കുന്നു.",
  successStuckNotice:
    "ഞങ്ങൾ ഇപ്പോഴും ശ്രമിക്കുന്നു -- കാത്തിരിക്കാം, അല്ലെങ്കിൽ വീണ്ടും sign in ചെയ്ത് നോക്കൂ.",
  signInAgainLink: "വീണ്ടും sign in ചെയ്യൂ",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "കോഡ് കിട്ടാൻ മറ്റൊരു വഴി",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "നിങ്ങളെക്കുറിച്ച് അൽപ്പം പറയൂ",
  profileNudgeSubtitle: "നിർബന്ധമല്ല -- അടുത്ത തവണ ജീവനക്കാർക്ക് നിങ്ങളെ തിരിച്ചറിയാൻ സഹായിക്കും.",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "രാജ്യ കോഡ്",
  otpCodeLabel: "6 അക്ക കോഡ്",
  otpCodeHint: "ഞങ്ങൾ അയച്ച 6 അക്ക കോഡ് നൽകൂ.",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "പിന്നിലേക്ക്",
  authMethodSubtitle: "ഓൺലൈൻ ആകാൻ താഴെയുള്ള ഫോം പൂരിപ്പിക്കൂ.",
  verifyTitle: "നിങ്ങളുടെ കോഡ് നൽകൂ",
  connectingTitle: "നിങ്ങളെ ഇന്റർനെറ്റിലേക്ക് കണക്ട് ചെയ്യുന്നു…",
  connectingSubtitle: "ഒരു നിമിഷം.",
  expiredSubtitle: "നിങ്ങളെ നെറ്റ്‌വർക്കിൽ നിന്ന് വിച്ഛേദിച്ചു.",
  expiredHelp: "Guest WiFi തുടർന്ന് ഉപയോഗിക്കാൻ വീണ്ടും sign in ചെയ്യൂ.",
  useOtpInsteadLabel: "പകരം OTP ഉപയോഗിക്കൂ",
  failureSubtitle: "നിങ്ങളുടെ വിവരങ്ങൾ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കൂ.",
  failureHelp: "പ്രശ്നം തുടർന്നാൽ സ്ഥാപനത്തിലെ ജീവനക്കാരോട് ചോദിക്കൂ.",
  offlineHelp: "ഇവിടത്തെ guest WiFi നെറ്റ്‌വർക്കിലാണോ നിങ്ങൾ എന്ന് ഉറപ്പാക്കി വീണ്ടും ശ്രമിക്കൂ.",
  redirectNoticeTemplate: "ഉടൻ നിങ്ങളെ {host}-ലേക്ക് അയയ്ക്കും.",
  redirectCountdownTemplate: "{n} സെക്കൻഡിൽ തുടരുന്നു",
  continueNowLabel: "ഇപ്പോൾ തന്നെ തുടരൂ",
  unknownMethodLabel: "അറിയാത്ത sign in രീതി.",
  usePasswordInstead: "പകരം സേവ് ചെയ്ത പാസ്‌വേഡ് ഉപയോഗിച്ച് sign in ചെയ്യൂ",
  termsReadFullDocument: "മുഴുവൻ രേഖയും വായിക്കൂ",
  termsQuestionsAskStaff:
    "ഈ നെറ്റ്‌വർക്കിനെയോ നിങ്ങളുടെ ഡേറ്റയെയോ കുറിച്ച് ചോദ്യങ്ങളുണ്ടോ? സ്ഥാപനത്തിലെ ജീവനക്കാരോട് ചോദിക്കൂ.",
  termsBackToSignIn: "Sign in-ലേക്ക് മടങ്ങൂ",
  nudgeSetPasswordTitle: "അടുത്ത തവണത്തേക്ക് പാസ്‌വേഡ് സെറ്റ് ചെയ്യൂ",
  nudgeSetPasswordSubtitle: "അടുത്ത തവണ കോഡ് വേണ്ടിവരില്ല",
  nudgeTeamTitle: "Team കോഡ് ഉണ്ടോ?",
  nudgeTeamSubtitle: "നിങ്ങളുടെ സംഘത്തിന്റെ പങ്കിട്ട ഡേറ്റയിലും ക്വോട്ടയിലും ചേരൂ",
  noExpiryLabel: "കാലാവധി ഇല്ല",
  ipUnknownLabel: "IP അറിയില്ല",
  disconnectingLabel: "വിച്ഛേദിക്കുന്നു…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "ഘട്ടം {n} / {total}",
  whyWeAskMobile: "നിങ്ങളുടെ ഒറ്റത്തവണ sign-in കോഡ് ഈ നമ്പറിലേക്ക് SMS ആയി അയയ്ക്കും.",
  whyWeAskWhatsapp: "നിങ്ങളുടെ ഒറ്റത്തവണ sign-in കോഡ് ഈ WhatsApp നമ്പറിലേക്ക് അയയ്ക്കും.",
  // ---- end v7 Part 8 block --------------------------------------------
};

// Punjabi (pa, Gurmukhi).
const PA: Dict = {
  loading: "ਤੁਹਾਡਾ connection ਤਿਆਰ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…",
  connect: "ਜੁੜੋ",
  learnMore: "ਹੋਰ ਜਾਣੋ",
  chooseMethod: "Sign in ਦਾ ਤਰੀਕਾ ਚੁਣੋ",
  mobileOtp: "ਮੋਬਾਈਲ OTP",
  emailOtp: "ਈਮੇਲ OTP",
  whatsappOtp: "WhatsApp OTP",
  passwordLogin: "ਪਾਸਵਰਡ",
  passwordLoginDesc: "ਆਪਣੇ ਸੇਵ ਕੀਤੇ ਪਾਸਵਰਡ ਨਾਲ sign in ਕਰੋ",
  voucher: "ਵਾਊਚਰ code",
  pms: "ਕਮਰੇ ਦਾ login",
  social: "ਸੋਸ਼ਲ login",
  qr: "QR ਨਾਲ sign in",
  clickThrough: "ਇੱਕ tap ਨਾਲ access",
  mobileNumber: "ਮੋਬਾਈਲ ਨੰਬਰ",
  emailAddress: "ਈਮੇਲ ਪਤਾ",
  password: "ਪਾਸਵਰਡ",
  signIn: "Sign in ਕਰੋ",
  sendOtp: "Code ਭੇਜੋ",
  verifyOtp: "ਪਰਖੋ",
  resend: "Code ਫਿਰ ਭੇਜੋ",
  changeNumber: "ਟਿਕਾਣਾ ਬਦਲੋ",
  voucherCode: "ਵਾਊਚਰ code",
  submit: "ਭੇਜੋ",
  roomNumber: "ਕਮਰਾ ਨੰਬਰ",
  lastName: "ਆਖ਼ਰੀ ਨਾਂ",
  scanInstructions: "ਜੁੜਨ ਲਈ ਆਪਣਾ ਕੈਮਰਾ ਖੋਲ੍ਹੋ ਤੇ QR code scan ਕਰੋ।",
  agreeTerms: "ਮੈਂ ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ ਤੇ ਪ੍ਰਾਈਵੇਸੀ ਨੀਤੀ ਨਾਲ ਸਹਿਮਤ ਹਾਂ",
  securityTipLabel: "ਸੁਰੱਖਿਅਤ ਰਹੋ",
  securityTipBody: "ਆਪਣਾ OTP ਜਾਂ ਪਾਸਵਰਡ ਕਿਸੇ ਨਾਲ ਵੀ ਸਾਂਝਾ ਨਾ ਕਰੋ, ਵੇਨਿਊ ਸਟਾਫ਼ ਨਾਲ ਵੀ ਨਹੀਂ।",
  connectedTitle: "ਤੁਸੀਂ ਜੁੜ ਗਏ",
  connectedSubtitle: "ਇਸ device ਉੱਤੇ ਹੁਣ ਤੇਜ਼ internet ਚਾਲੂ ਹੈ।",
  logout: "ਵੱਖ ਹੋਵੋ",
  continue: "Browsing ਜਾਰੀ ਰੱਖੋ",
  authFailed: "ਅਸੀਂ ਤੁਹਾਨੂੰ sign in ਨਹੀਂ ਕਰ ਸਕੇ",
  retry: "ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
  contactSupport: "Support ਨਾਲ ਸੰਪਰਕ ਕਰੋ",
  sessionRemaining: "ਬਾਕੀ ਸਮਾਂ",
  dataUsage: "Data ਵਰਤੋਂ",
  device: "ਤੁਹਾਡਾ device",
  sessionExpired: "ਤੁਹਾਡਾ session ਪੂਰਾ ਹੋ ਗਿਆ",
  reconnect: "ਮੁੜ ਜੁੜੋ",
  extend: "Session ਵਧਾਓ",
  redirecting: "ਤੁਹਾਨੂੰ ਹੁਣੇ ਅੱਗੇ ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  offlineTitle: "ਤੁਸੀਂ offline ਹੋ",
  offlineSubtitle: "ਆਪਣਾ WiFi connection ਵੇਖੋ ਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  skipAd: "ਛੱਡੋ",
  termsTitle: "ਸ਼ਰਤਾਂ ਤੇ ਪ੍ਰਾਈਵੇਸੀ",
  welcomeCta: "ਸ਼ੁਰੂ ਕਰੋ",
  language: "ਭਾਸ਼ਾ",
  a11y: "ਪਹੁੰਚਯੋਗਤਾ",
  highContrast: "ਵੱਧ contrast",
  largeText: "ਵੱਡੇ ਅੱਖਰ",
  wifi: "WiFi",
  setPasswordTitle: "ਅਗਲੀ ਵਾਰ code ਛੱਡਣਾ ਹੈ?",
  setPasswordSubtitle: "ਹੁਣੇ ਪਾਸਵਰਡ ਸੇਵ ਕਰੋ ਤੇ ਅਗਲੀ ਵਾਰ ਸਿਰਫ਼ ਆਪਣੇ ਨੰਬਰ ਨਾਲ sign in ਕਰੋ।",
  newPassword: "ਨਵਾਂ ਪਾਸਵਰਡ",
  confirmPassword: "ਪਾਸਵਰਡ ਦੁਬਾਰਾ ਭਰੋ",
  savePassword: "ਪਾਸਵਰਡ ਸੇਵ ਕਰੋ",
  skipForNow: "ਹੁਣੇ ਨਹੀਂ",
  passwordSaved: "ਪਾਸਵਰਡ ਸੇਵ ਹੋ ਗਿਆ -- ਅਗਲੀ ਵਾਰ ਇਸੇ ਨਾਲ sign in ਕਰ ਸਕਦੇ ਹੋ।",

  // Closes CampaignOverlay.tsx's gap.
  surveyQuestion: "ਛੋਟਾ ਜਿਹਾ ਸਵਾਲ",
  sponsored: "ਸਪਾਂਸਰ ਕੀਤਾ",
  submitting: "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  sponsorMessage: "ਇੱਕ ਸਪਾਂਸਰ ਦਾ ਤੁਹਾਡੇ ਲਈ ਸੁਨੇਹਾ ਹੈ।",
  continueCta: "ਜਾਰੀ ਰੱਖੋ",
  answerPlaceholder: "ਆਪਣਾ ਜਵਾਬ ਲਿਖੋ…",

  // Closes portal.closed.tsx's gap.
  closedTitleDefault: "ਇਸ ਵੇਲੇ ਬੰਦ ਹੈ",
  closedSubtitle: "ਅਸੀਂ ਇਸ ਵੇਲੇ ਬੰਦ ਹਾਂ। ਜੁੜਨ ਲਈ ਕੰਮ ਦੇ ਵੇਲੇ ਦੌਰਾਨ ਫਿਰ ਵੇਖੋ।",

  // Closes portal.team.tsx's gap.
  teamAlreadyJoined: "ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਇਸ ਟੀਮ ਵਿੱਚ ਹੋ।",
  teamJoined: "ਤੁਸੀਂ ਟੀਮ ਵਿੱਚ ਜੁੜ ਗਏ!",
  joinTeam: "ਟੀਮ ਵਿੱਚ ਜੁੜੋ",
  teamPageTitle: "ਕਿਸੇ ਟੀਮ ਵਿੱਚ ਜੁੜੋ",
  teamPageSubtitle: "ਉਹ ਟੀਮ code ਭਰੋ ਜੋ ਤੁਹਾਡੇ ਗਰੁੱਪ ਦੇ ਪ੍ਰਬੰਧਕ ਨੇ ਤੁਹਾਨੂੰ ਦਿੱਤਾ ਹੈ।",
  teamJoinedHelper:
    "ਤੁਹਾਡੇ connection ਉੱਤੇ ਕੋਈ ਅਸਰ ਨਹੀਂ -- ਇਹ ਸਿਰਫ਼ ਤੁਹਾਨੂੰ ਤੁਹਾਡੀ ਟੀਮ ਨਾਲ ਜੋੜਦਾ ਹੈ।",
  backToConnection: "ਮੇਰੇ connection ’ਤੇ ਵਾਪਸ",
  teamCodeLabel: "ਟੀਮ code",
  teamCodePlaceholder: "ਜਿਵੇਂ AB23CD45",

  // Closes PortalShell.tsx's gap.
  guestWifiFallback: "ਮਹਿਮਾਨ WiFi",
  guestNetwork: "ਮਹਿਮਾਨ network",
  brandHeadlineBase: "ਤੇਜ਼, ਸੁਰੱਖਿਅਤ WiFi",
  courtesyOfTemplate: ", {venue} ਵੱਲੋਂ",
  verifyDeviceCta: "ਜੁੜਨ ਲਈ ਸੱਜੇ ਪਾਸੇ ਆਪਣਾ device ਪਰਖੋ।",
  supportAskStaff: "Support: ਸਟਾਫ਼ ਨੂੰ ਪੁੱਛੋ",
  poweredByWyfy: "Wyfy Guest ’ਤੇ ਚੱਲਦਾ ਹੈ",

  // Closes GuestSignInCard.tsx's gap.
  welcomeToVenueTemplate: "{venue} ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ",
  welcomeBare: "ਸੁਆਗਤ ਹੈ",
  signInSubtext: "ਇਸ network ਉੱਤੇ ਮੁਫ਼ਤ WiFi ਲਈ sign in ਕਰੋ।",
  verifyingCode: "ਤੁਹਾਡਾ code ਪਰਖਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  signingIn: "ਤੁਹਾਨੂੰ sign in ਕਰ ਰਹੇ ਹਾਂ…",
  noMethodsAvailable: "Sign in ਦਾ ਕੋਈ ਤਰੀਕਾ ਚਾਲੂ ਨਹੀਂ ਹੈ। ਰਿਸੈਪਸ਼ਨ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
  agreeToThe: "ਮੈਂ ਸਹਿਮਤ ਹਾਂ",
  termsAcceptableUsePolicy: "ਸ਼ਰਤਾਂ ਤੇ ਵਰਤੋਂ ਦੀ ਨੀਤੀ",
  dataConsentLabel: "ਮੈਂ ਸਹਿਮਤ ਹਾਂ ਕਿ ਮੇਰਾ ਫ਼ੋਨ/ਈਮੇਲ, ਡਿਵਾਈਸ ਅਤੇ ਸੈਸ਼ਨ ਵੇਰਵੇ ਇਕੱਠੇ ਕੀਤੇ ਜਾਣ —",
  dataConsentLearnMore: "ਵੇਰਵੇ ਦੇਖੋ",
  otpTabSms: "ਮੈਨੂੰ SMS ’ਤੇ code ਭੇਜੋ",
  otpTabEmail: "ਮੈਨੂੰ ਈਮੇਲ ’ਤੇ code ਭੇਜੋ",
  otpTabWhatsapp: "ਮੈਨੂੰ WhatsApp ’ਤੇ code ਭੇਜੋ",
  haveAPassword: "ਮੇਰੇ ਕੋਲ ਪਾਸਵਰਡ ਹੈ",
  tellUsAboutYourself: "ਤੁਸੀਂ ਜੁੜ ਗਏ! ਆਪਣੇ ਬਾਰੇ ਥੋੜ੍ਹਾ ਦੱਸੋ",
  optionalLabel: "(ਲਾਜ਼ਮੀ ਨਹੀਂ)",
  nameLabel: "ਨਾਂ",
  savingLabel: "ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…",
  whatsappNumberLabel: "WhatsApp ਨੰਬਰ",
  sendingLabel: "ਭੇਜ ਰਹੇ ਹਾਂ…",
  sentCodeToPrefix: "ਅਸੀਂ 6 ਅੰਕਾਂ ਦਾ code ਇੱਥੇ ਭੇਜਿਆ ਹੈ",
  verifyingLabel: "ਪਰਖਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  verifyOtpConnect: "OTP ਪਰਖੋ ਤੇ ਜੁੜੋ",
  resendAvailableInTemplate: "{n}s ਬਾਅਦ ਫਿਰ ਭੇਜ ਸਕੋਗੇ",
  changeNumberLabel: "ਨੰਬਰ ਬਦਲੋ",
  mobileOrEmailLabel: "ਮੋਬਾਈਲ ਨੰਬਰ ਜਾਂ ਈਮੇਲ",
  signingInLabel: "Sign in ਹੋ ਰਿਹਾ ਹੈ…",
  signInConnect: "Sign in ਕਰੋ ਤੇ ਜੁੜੋ",
  forgotUseOtp: "ਭੁੱਲ ਗਏ? OTP ਵਰਤੋ",
  voucherFallbackPrefix: "ਇਹ ਥਾਂ ਮਹਿਮਾਨਾਂ ਨੂੰ ਵਾਊਚਰ code ਨਾਲ sign in ਕਰਾਉਂਦੀ ਹੈ --",
  redeemVoucherLink: "ਆਪਣਾ ਵਾਊਚਰ ਇੱਥੇ ਵਰਤੋ",
  otherWaysToSignIn: "Sign in ਦੇ ਹੋਰ ਤਰੀਕੇ",
  useMobileInstead: "ਇਸਦੀ ਥਾਂ ਮੋਬਾਈਲ ਨੰਬਰ ਵਰਤੋ",
  useEmailInstead: "ਇਸਦੀ ਥਾਂ ਈਮੇਲ ਵਰਤੋ",
  useWhatsappInstead: "ਇਸਦੀ ਥਾਂ WhatsApp ਵਰਤੋ",
  haveVoucherUseInstead: "ਵਾਊਚਰ code ਹੈ? ਉਹੀ ਵਰਤੋ",
  savedPasswordsNote: "ਸੇਵ ਕੀਤਾ ਪਾਸਵਰਡ ਪਹਿਲੇ OTP sign-in ਤੋਂ ਤੁਰੰਤ ਬਾਅਦ ਸੈੱਟ ਹੁੰਦਾ ਹੈ।",
  errValidWhatsapp: "ਸਹੀ WhatsApp ਨੰਬਰ ਭਰੋ",
  errValidMobile: "ਸਹੀ ਮੋਬਾਈਲ ਨੰਬਰ ਭਰੋ",
  errValidEmail: "ਸਹੀ ਈਮੇਲ ਪਤਾ ਭਰੋ",
  errEnterCode: "6 ਅੰਕਾਂ ਦਾ code ਭਰੋ",
  errAcceptTerms: "ਜਾਰੀ ਰੱਖਣ ਲਈ ਸ਼ਰਤਾਂ ਤੇ ਵਰਤੋਂ ਦੀ ਨੀਤੀ ਮੰਨੋ।",
  errAcceptDataConsent: "ਜਾਰੀ ਰੱਖਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਉਪਰੋਕਤ ਡਾਟਾ ਇਕੱਠਾ ਕਰਨ ਲਈ ਸਹਿਮਤੀ ਦਿਓ।",
  errPhoneEmailPassword: "ਆਪਣਾ ਫ਼ੋਨ/ਈਮੇਲ ਤੇ ਪਾਸਵਰਡ ਭਰੋ",

  // Closes portal.success.tsx's gap.
  successSlowNotice: "ਇਸ ਵਿੱਚ ਸੋਚ ਨਾਲੋਂ ਵੱਧ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ।",
  successStuckNotice:
    "ਅਸੀਂ ਹਾਲੇ ਵੀ ਕੋਸ਼ਿਸ਼ ਕਰ ਰਹੇ ਹਾਂ -- ਤੁਸੀਂ ਉਡੀਕ ਸਕਦੇ ਹੋ, ਜਾਂ ਫਿਰ ਤੋਂ sign in ਕਰ ਵੇਖੋ।",
  signInAgainLink: "ਫਿਰ ਤੋਂ sign in ਕਰੋ",

  // Closes GuestSignInCard's tier-2 OTP-channel switcher.
  switchOtpChannel: "Code ਲੈਣ ਦਾ ਹੋਰ ਤਰੀਕਾ",

  // Closes portal.session.tsx's new profile nudge card.
  profileNudgeTitle: "ਆਪਣੇ ਬਾਰੇ ਥੋੜ੍ਹਾ ਦੱਸੋ",
  profileNudgeSubtitle: "ਲਾਜ਼ਮੀ ਨਹੀਂ -- ਅਗਲੀ ਵਾਰ ਸਟਾਫ਼ ਨੂੰ ਤੁਹਾਨੂੰ ਪਛਾਣਨ ਵਿੱਚ ਮਦਦ ਮਿਲਦੀ ਹੈ।",

  // v7 §7.2 -- see the EN block.
  countryCodeLabel: "ਦੇਸ਼ ਦਾ code",
  otpCodeLabel: "6 ਅੰਕਾਂ ਦਾ code",
  otpCodeHint: "ਅਸੀਂ ਜੋ 6 ਅੰਕਾਂ ਦਾ code ਭੇਜਿਆ ਹੈ, ਉਹ ਭਰੋ।",
  // ---- portal redesign (shadcn pass) block -- see EN's copy for notes --
  backLabel: "ਪਿੱਛੇ",
  authMethodSubtitle: "Online ਹੋਣ ਲਈ ਹੇਠਾਂ ਦਿੱਤਾ ਫ਼ਾਰਮ ਭਰੋ।",
  verifyTitle: "ਆਪਣਾ ਕੋਡ ਭਰੋ",
  connectingTitle: "ਤੁਹਾਨੂੰ ਇੰਟਰਨੈੱਟ ਨਾਲ ਜੋੜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  connectingSubtitle: "ਬੱਸ ਇੱਕ ਪਲ।",
  expiredSubtitle: "ਤੁਹਾਨੂੰ network ਤੋਂ disconnect ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।",
  expiredHelp: "Guest WiFi ਵਰਤਦੇ ਰਹਿਣ ਲਈ ਫਿਰ ਤੋਂ sign in ਕਰੋ।",
  useOtpInsteadLabel: "ਇਸਦੀ ਥਾਂ OTP ਵਰਤੋ",
  failureSubtitle: "ਆਪਣੀ ਜਾਣਕਾਰੀ ਵੇਖੋ ਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  failureHelp: "ਸਮੱਸਿਆ ਰਹੇ ਤਾਂ ਸਟਾਫ਼ ਨੂੰ ਪੁੱਛੋ।",
  offlineHelp: "ਵੇਖੋ ਕਿ ਤੁਸੀਂ ਇੱਥੋਂ ਦੇ guest WiFi network ਨਾਲ ਜੁੜੇ ਹੋ, ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  redirectNoticeTemplate: "ਤੁਹਾਨੂੰ ਹੁਣੇ {host} ’ਤੇ ਭੇਜਿਆ ਜਾਵੇਗਾ।",
  redirectCountdownTemplate: "{n} ਸਕਿੰਟ ਵਿੱਚ ਅੱਗੇ ਵਧ ਰਹੇ ਹਾਂ",
  continueNowLabel: "ਹੁਣੇ ਅੱਗੇ ਵਧੋ",
  unknownMethodLabel: "ਅਣਜਾਣ sign in ਤਰੀਕਾ।",
  usePasswordInstead: "ਇਸਦੀ ਥਾਂ ਸੇਵ ਕੀਤੇ ਪਾਸਵਰਡ ਨਾਲ sign in ਕਰੋ",
  termsReadFullDocument: "ਪੂਰਾ ਦਸਤਾਵੇਜ਼ ਪੜ੍ਹੋ",
  termsQuestionsAskStaff: "ਇਸ network ਜਾਂ ਆਪਣੇ ਡਾਟੇ ਬਾਰੇ ਸਵਾਲ? ਸਟਾਫ਼ ਨੂੰ ਪੁੱਛੋ।",
  termsBackToSignIn: "Sign in ’ਤੇ ਵਾਪਸ ਜਾਓ",
  nudgeSetPasswordTitle: "ਅਗਲੀ ਵਾਰ ਲਈ ਪਾਸਵਰਡ ਸੈੱਟ ਕਰੋ",
  nudgeSetPasswordSubtitle: "ਅਗਲੀ ਵਾਰ ਕੋਡ ਦੀ ਲੋੜ ਨਹੀਂ ਪਵੇਗੀ",
  nudgeTeamTitle: "Team ਕੋਡ ਹੈ?",
  nudgeTeamSubtitle: "ਆਪਣੇ ਗਰੁੱਪ ਦੇ ਸਾਂਝੇ ਡਾਟੇ ਤੇ ਕੋਟੇ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ",
  noExpiryLabel: "ਕੋਈ ਮਿਆਦ ਨਹੀਂ",
  ipUnknownLabel: "IP ਅਣਜਾਣ",
  disconnectingLabel: "Disconnect ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…",
  // ---- end portal-redesign block ---------------------------------------
  // ---- v7 Part 8 (sign-in flow) -- ADDED BY THE PART 8 WORKSTREAM ------
  // See the EN block. Same three keys.
  stepProgressTemplate: "ਕਦਮ {n} / {total}",
  whyWeAskMobile: "ਅਸੀਂ ਤੁਹਾਡਾ ਇੱਕ-ਵਾਰੀ sign-in code ਇਸੇ ਨੰਬਰ ’ਤੇ SMS ਰਾਹੀਂ ਭੇਜਦੇ ਹਾਂ।",
  whyWeAskWhatsapp: "ਅਸੀਂ ਤੁਹਾਡਾ ਇੱਕ-ਵਾਰੀ sign-in code ਇਸੇ WhatsApp ਨੰਬਰ ’ਤੇ ਭੇਜਦੇ ਹਾਂ।",
  // ---- end v7 Part 8 block --------------------------------------------
};

const DICTS: Record<RuntimeLanguage, Dict> = {
  en: EN,
  hi: HI,
  bn: BN,
  mr: MR,
  te: TE,
  ta: TA,
  gu: GU,
  kn: KN,
  ml: ML,
  pa: PA,
};

/** Re-exported from `types/portal-runtime.ts`, where the single copy lives --
 * see `RUNTIME_LANGUAGE_LABEL`'s own comment. Kept exported under this name
 * so `LanguageSwitcher` and the other guest-flow callers don't all have to
 * change import paths for a map that has not changed shape. */
export const LANGUAGE_LABEL = RUNTIME_LANGUAGE_LABEL;

/** Falls back per KEY, not per language: a dictionary that somehow lacked a
 * key still renders the English string for that one key rather than dropping
 * to English wholesale. With `ar`/`fr`/`es` gone this is a genuine safety net
 * again rather than the load-bearing mechanism it used to be -- those three
 * "supported" languages resolved essentially every key through this line. */
export function translate(lang: RuntimeLanguage, key: string): string {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
}

/* RTL SUPPORT WAS REMOVED HERE, DELIBERATELY, ALONG WITH ARABIC.
 *
 * This module used to export `RTL_LANGS = ["ar"]`, which
 * `PortalRuntimeContext` read to set `document.documentElement.dir`. Arabic
 * was the only entry, and every one of the ten languages the portal now
 * ships is left-to-right, so keeping it would have meant keeping a
 * permanently-empty array and a branch that can never be taken.
 *
 * The case for keeping it was that Urdu is a plausible future addition and
 * the machinery is two lines. That argument fails on inspection, because
 * those two lines were never the actual cost of RTL here. Flipping `dir`
 * mirrors the box model, and this portal's layout is built almost entirely
 * from PHYSICAL properties, not logical ones: `ml-`/`mr-`/`pl-`/`pr-`,
 * `left-`/`right-`, `text-left`, the absolutely-positioned shell chrome, and
 * the v7 backdrop work (`portal-backdrop.ts`'s focal-point math and
 * `PortalTextPlate`'s placement) all assume LTR. None of it has ever been
 * rendered RTL by anyone, because no venue ever enabled Arabic.
 *
 * So the two lines did not deliver RTL support; they delivered a mirrored,
 * unaudited layout on top of a dictionary that was 96% English -- the same
 * class of "the checkbox exists, therefore the feature exists" failure this
 * whole change is undoing. Deleting them makes the next person who adds Urdu
 * do the real work (audit those physical properties, then reintroduce a
 * `dir` toggle) instead of ticking a box and shipping something broken.
 *
 * To restore: add the language to `RUNTIME_LANGUAGES`, reintroduce an
 * `RTL_LANGS` list here, and set `root.dir` from it in
 * `PortalRuntimeContext`'s `resolvedLanguage` effect -- which is where the
 * removed `dir` assignment used to live, and which still sets `root.lang`. */

// Guest language-choice persistence -- see PortalRuntimeContext.tsx. The
// portal has no authenticated guest identity to key a backend preference
// off reliably (guests aren't logged-in users), so client-side storage is
// the right layer here, not a new backend field. Without this, `language`
// state was a bare `useState` that reset on every remount (reload, an OS's
// own periodic captive-portal re-probe reopening the URL, etc.) -- a real,
// pre-existing bug independent of Hindi.
const LANG_STORAGE_KEY = "cg_portal_lang";

export function loadPersistedLanguage(): RuntimeLanguage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    // `toRuntimeLanguage` returns `undefined` for anything it doesn't
    // recognize, which is exactly the contract this function already had --
    // so a guest whose browser still holds `cg_portal_lang: "ar"` from
    // before this change reads as "no stored preference" and falls through
    // to the venue's own default, rather than to a language that no longer
    // has a dictionary.
    return toRuntimeLanguage(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/** Reads the guest's language out of the CURRENT URL's `?lang=`.
 *
 * This is the half of language persistence that works where storage does
 * not. `loadPersistedLanguage` above is best-effort by construction -- on
 * iOS's Captive Network Assistant `localStorage` throws rather than fails
 * (docs/captive-portal-v7-design-spec.md §0.2), so a guest's choice was
 * simply lost across `portal.success.tsx`'s full-document form POST, and the
 * connected/session screen came back in the venue's default language. See
 * `buildSessionUrl` (src/lib/portal-session-url.ts) for the full write-up
 * and for where the parameter is put on the URL in the first place.
 *
 * Reads `window.location.search` directly rather than the router's parsed
 * search: this has to work on the very first render of a brand-new document
 * that the NAS -- not our router -- navigated to, and it is called from
 * context code that sits above any individual route. Unrecognized values
 * (including a since-removed `"ar"`, or anything a guest hand-typed) return
 * `undefined` and fall through to the normal defaulting path. */
export function readLanguageFromUrl(): RuntimeLanguage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return toRuntimeLanguage(new URLSearchParams(window.location.search).get("lang"));
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
