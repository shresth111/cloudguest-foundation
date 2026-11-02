/**
 * ERROR-COPY: every word the partner console shows for a failed request.
 *
 * One module, so Hindi can be added later without touching the screens:
 * the strings are an i18next-shaped namespace (flat keys, `{{var}}`
 * interpolation). To add a language, load `ISP_ERROR_COPY_EN`'s keys in that
 * language into an i18next instance and call
 * `setIspErrorTranslator((key, vars) => i18n.t(key, { ns: "ispErrors", ...vars }))`.
 * Until then `translate` interpolates the English text below.
 *
 * Keys:
 *   code.<BACKEND_CODE>   one per `data.code` / `data.reason` the ISP API sends
 *                         (inventory: scripts/isp-error-codes.json, guarded by
 *                         scripts/test-isp-partner-error-copy.mjs)
 *   status.<class>        fallback per status class
 *   field.<pydantic type> 422 field messages
 *   ui.<name>             labels used around errors (buttons, refs)
 *
 * Wording rules: say what happened and what to do next; plain English for an
 * ISP operator; never name the platform's tunnel or VPN (wording test).
 */

const FEATURE_OFF =
  "This feature is not switched on for your account. Ask Wyfy Guest support if you need it.";
const GONE = (thing: string) =>
  `That ${thing} could not be found. It may have been deleted, or you may not have access to it. Refresh the page.`;

export const ISP_ERROR_COPY_EN: Record<string, string> = {
  // -- account and access ---------------------------------------------------
  "code.ISP_PARTNER_REQUIRED":
    "This account is not an ISP partner account. Sign in with your ISP login.",
  "code.ISP_ROLE_REQUIRED": "Your login has no role in this ISP. Ask your ISP Owner to add you.",
  "code.ISP_PARTNER_SUSPENDED": "This ISP account is suspended. Contact Wyfy Guest support.",
  "code.ISP_ROLE_ESCALATION": "Only an ISP Owner can give or change the Owner or Admin role.",
  "code.ISP_ROLE_INVALID":
    "That role cannot be given from this console. Pick one of the listed roles.",
  "code.ISP_LAST_OWNER":
    "This is the last active ISP Owner. Add another Owner before you disable or change this one.",
  "code.ISP_CONFINEMENT_NOT_ALLOWED":
    "Owners and Admins always see every customer, so they cannot be limited to some customers.",
  "code.ISP_OWNER_GRANT_REFUSED": "Only the ISP Owner role can be given here.",
  "code.ISP_ROLES_NOT_SEEDED": "Roles are not ready on the server yet. Contact Wyfy Guest support.",
  "code.ISP_PERMANENT_BLOCK_OWNER_ONLY": "Only an ISP Owner or Admin can lift a permanent block.",
  "code.ISP_LEA_OWNER_ADMIN_ONLY": "Only an ISP Owner or Admin can run a reverse-IP trace report.",
  "code.ISP_PII_MASKED":
    "Connection records with guest addresses are not switched on for your account, or your role is not Owner or Admin.",
  "code.ISP_SCOPE_HEADERS_NOT_ALLOWED":
    "The page sent a request this console does not accept. Refresh the page.",
  "code.ISP_SCOPE_VIOLATION":
    "Something went wrong on our side and nothing was changed. Try again, or contact support.",
  "code.ISP_FORCE_NOT_ALLOWED": "Forcing a new cloud link is not allowed from the partner console.",
  "code.ISP_WEBHOOK_REJECTED": "The request was refused. Check the webhook settings and try again.",
  "code.USER_EMAIL_TAKEN":
    "A user with this email already exists. Use another email, or edit that user.",
  "code.ISP_USER_NOT_FOUND": GONE("user"),
  "code.ISP_PARTNER_NOT_FOUND": GONE("ISP account"),

  // -- switched-off features -----------------------------------------------
  "code.ISP_FEATURE_DISABLED": FEATURE_OFF,
  "code.ISP_AUDIT_LOG_DISABLED": FEATURE_OFF,
  "code.ISP_COLLECTIONS_DISABLED": FEATURE_OFF,
  "code.ISP_COMMS_HUB_DISABLED": FEATURE_OFF,
  "code.ISP_DASHBOARD_DISABLED": FEATURE_OFF,
  "code.ISP_ENFORCEMENT_DISABLED": FEATURE_OFF,
  "code.ISP_FRANCHISE_DISABLED": FEATURE_OFF,
  "code.ISP_INCIDENTS_DISABLED": FEATURE_OFF,
  "code.ISP_IPDR_LEA_DISABLED": FEATURE_OFF,
  "code.ISP_NETMON_DISABLED": FEATURE_OFF,
  "code.ISP_QUEUED_RENEWAL_DISABLED": FEATURE_OFF,
  "code.ISP_REFERRALS_DISABLED": FEATURE_OFF,
  "code.ISP_REVENUE_HUB_DISABLED": FEATURE_OFF,
  "code.ISP_SUB360_WORKBENCH_DISABLED": FEATURE_OFF,
  "code.ISP_ZONES_DISABLED": FEATURE_OFF,
  "code.ISP_CAF_LEADS_OFF":
    "Leads are not switched on for your account. Ask Wyfy Guest support if you need them.",
  "code.ISP_RENEW_CYCLES_OFF":
    "Renewing for more than one month at a time is not switched on for your account. Renew one cycle at a time.",
  "code.ISP_DISCOUNT_APPLY_OFF":
    "Discount codes on bills are not switched on yet. Remove the code to continue.",
  "code.ISP_SMS_REMINDERS_UNAVAILABLE":
    "SMS reminders are not available yet. Send an email reminder instead.",
  "code.ISP_ADDON_NOT_ALLOWED":
    "This add-on is not enabled for your ISP account. Ask Wyfy Guest support to enable it.",
  "code.ISP_ADDON_LIMIT":
    "This add-on is already on for as many customers as your plan allows. Turn it off for another customer, or ask Wyfy Guest to raise the limit.",
  "code.ISP_ADDON_UNKNOWN": "That add-on does not exist. Refresh the page.",
  "code.ISP_NOT_AVAILABLE_YET": "This is not available from the partner console yet.",
  "code.TR069_NOT_ENABLED":
    "TR-069 device management is not switched on yet. Contact Wyfy Guest support.",

  // -- customers, locations, routers ---------------------------------------
  "code.ISP_CUSTOMER_NOT_FOUND": GONE("customer"),
  "code.ISP_LOCATION_NOT_FOUND": GONE("location"),
  "code.ISP_ROUTER_NOT_FOUND": GONE("router"),
  "code.ISP_PORTAL_CONFIG_NOT_FOUND": GONE("portal"),
  "code.ISP_PORTAL_SUPPORT_NOT_FOUND":
    "No support contact is set for this location. Add one in Settings.",
  "code.ISP_CUSTOMER_LIMIT":
    "Your ISP has reached its customer limit. Contact Wyfy Guest to raise it.",
  "code.ISP_CUSTOMER_SLUG_TAKEN":
    "Another customer already uses this short name (slug). Pick a different one.",
  "code.ISP_SLUG_TAKEN": "This short name (slug) is already taken. Pick a different one.",
  "code.ISP_EXTERNAL_REF_TAKEN":
    "Another customer already uses this account number. Check the number or use a different one.",
  "code.ISP_CUSTOMER_REQUIRED": "Pick a customer first.",
  "code.ISP_CUSTOMER_SUSPENDED":
    "This customer is suspended. Resume its service first (refresh still works; reboot does not).",
  "code.ISP_SERVICE_TRANSITION_IN_PROGRESS":
    "A suspend or resume for this customer is already running. Wait a minute, refresh, and try again.",
  "code.ISP_SUSPEND_REASON_INVALID": "Pick one of the listed reasons.",
  "code.ISP_VENDOR_NOT_SUPPORTED": "Only MikroTik routers can be added for now.",
  "code.ISP_PPPOE_ROUTER_NOT_READY":
    "Finish this router's main setup first, then generate the PPPoE script.",
  "code.ISP_MOVE_SAME_CUSTOMER":
    "The subscriber is already with that customer. Pick a different customer.",
  "code.ISP_VENUE_CONTEXT_MISSING":
    "The page lost track of which venue you are working on. Go back to the venue and open this again.",
  "code.ISP_RANGE_TOO_LONG": "Pick a date range of 92 days or less.",

  // -- subscribers and plans -----------------------------------------------
  "code.ISP_SUBSCRIBER_NOT_FOUND": GONE("subscriber"),
  "code.ISP_PACKAGE_NOT_FOUND": GONE("package"),
  "code.PLAN_NOT_FOUND":
    "That plan does not exist any more. Refresh the page and pick another plan.",
  "code.ISP_SPEED_GROUP_NOT_FOUND": GONE("speed group"),
  "code.ISP_COUPON_NOT_FOUND":
    "That coupon code does not exist. Check the code with the subscriber.",
  "code.ISP_COUPON_BATCH_NOT_FOUND": GONE("coupon batch"),
  "code.ISP_NAME_TAKEN": "This name is already used. Pick a different name.",
  "code.ISP_GROUP_IN_USE":
    "This speed group still has packages or subscribers. Move them to another group first.",
  "code.ISP_PACKAGE_IN_USE":
    "Subscribers are on this package, so it cannot be changed this way. Disable it, or duplicate it and edit the copy.",
  "code.ISP_PACKAGE_DISABLED":
    "This package is disabled. Enable it in Plans, or pick another package.",
  "code.ISP_PACKAGE_NEEDS_PRICE": "This package has no price yet. Set a price in Plans first.",
  "code.ISP_BURST_INCOMPLETE":
    "Burst needs all four values (rate, threshold, time, limit), and each must be above the base speed.",
  "code.ISP_SUBSCRIBER_BLOCKED": "This subscriber is blocked. Unblock them first.",
  "code.ISP_SUBSCRIBER_DISABLED": "This subscriber is disabled. Enable them first.",
  "code.ISP_SUBSCRIBER_FROZEN": "This subscriber is frozen. Unfreeze them first.",
  "code.ISP_SUBSCRIBER_NOT_BLOCKED":
    "This subscriber is not blocked. Refresh the page to see the current status.",
  "code.ISP_SUBSCRIBER_NOT_FROZEN":
    "This subscriber is not frozen. Refresh the page to see the current status.",
  "code.ISP_FREEZE_NEEDS_VALIDITY":
    "Only a subscriber with validity left can be frozen. Renew first.",
  "code.ISP_GRACE_ACTIVE": "A grace period is already running for this subscriber.",
  "code.ISP_NOTHING_TO_REVERT": "There is no renewal to undo for this subscriber.",
  "code.ISP_REVERT_PAID":
    "This renewal has a payment recorded. Void the payment first, then undo the renewal.",
  "code.ISP_PROFILE_INVALID":
    "One of the profile details is not valid. Check the highlighted field.",
  "code.ISP_ONBOARD_STEP_FAILED":
    "Adding the subscriber failed and nothing was saved. Check the details and try again.",
  "code.ISP_QUEUED_RENEWAL_NOT_FOUND": GONE("queued renewal"),
  "code.ISP_QUEUED_RENEWAL_STATE":
    "This queued renewal cannot be changed now. Refresh the page to see its current status.",
  "code.ISP_REFERRAL_NOT_FOUND": GONE("referral"),
  "code.ISP_REFERRAL_INVALID":
    "This referral is not allowed. Check the referral settings and both subscribers.",

  // -- PPPoE and addresses -------------------------------------------------
  "code.ISP_PPPOE_BAD_USERNAME":
    "Username must be 3 to 64 characters: letters, numbers and . _ @ - only.",
  "code.ISP_PPPOE_BAD_PASSWORD": "Password must be 8 to 64 characters, with no spaces or quotes.",
  "code.ISP_PPPOE_USERNAME_TAKEN":
    "Another subscriber already uses this PPPoE username. Pick a different one.",
  "code.ISP_PPPOE_NOT_CONFIGURED": "This subscriber has no PPPoE login yet. Add one first.",
  "code.ISP_PPPOE_SESSION_NOT_FOUND": "That PPPoE session has already ended. Refresh the page.",
  "code.ISP_PPPOE_DEVICE_UNREACHABLE":
    "We could not reach the router to end the session. Check the router is online, then try again.",
  "code.ISP_PPPOE_SCRIPT_PARAM":
    "One of the script settings is not valid. Check the highlighted field.",
  "code.ISP_PPPOE_POOL_NAME_INVALID": "Pool name can use letters, numbers and . _ - only.",
  "code.ISP_IP_INVALID": "Enter a valid IP address, like 192.168.1.10.",
  "code.ISP_MAC_INVALID": "Enter a valid MAC address, like AA:BB:CC:DD:EE:FF.",
  "code.ISP_IP_POOL_NOT_FOUND": GONE("IP pool"),
  "code.ISP_IP_POOL_EXHAUSTED":
    "This IP pool has no free address left. Free an address or add a bigger pool.",
  "code.ISP_IP_TAKEN":
    "This IP is already given to another subscriber at this location. Pick a different IP.",
  "code.ISP_BINDING_NOT_FOUND": GONE("IP binding"),
  "code.ISP_STATIC_IP_IN_USE":
    "This IP already has an active lease. End that lease first, or pick another IP.",

  // -- billing --------------------------------------------------------------
  "code.ISP_BILLING_NOT_CONFIGURED":
    "Billing is not set up yet. Fill in Billing → Settings (legal name, state, invoice prefix) first.",
  "code.ISP_PLAN_FIELD_REQUIRED":
    "This customer's plan needs a plan name, an amount and a billing cycle. Fill in the highlighted field.",
  "code.ISP_INVOICE_NOT_FOUND": GONE("invoice"),
  "code.ISP_PAYMENT_NOT_FOUND": GONE("payment"),
  "code.ISP_INVOICE_VOID": "This invoice is cancelled, so it cannot be changed or paid.",
  "code.ISP_INVOICE_CANCELLED": "This invoice is cancelled, so it cannot be changed or paid.",
  "code.ISP_INVOICE_PAID": "This invoice is already paid in full.",
  "code.ISP_PAYMENT_MODE_INVALID": "Pick cash, UPI, bank transfer or online.",
  "code.ISP_PAYMENT_REFERENCE_REQUIRED":
    "UPI and bank transfers need the UTR / transaction reference. Enter it to continue.",
  "code.ISP_CREDIT_EXCEEDS_BALANCE":
    "The credit note is more than what is still due on this invoice. Lower the amount.",
  "code.ISP_INVOICE_PREFIX_TOO_LONG": "Invoice prefix must be 1 to 4 capital letters or numbers.",
  "code.ISP_INVOICE_DATE_OUT_OF_RANGE":
    "Invoice date must be within the last 7 days and in this financial year.",
  "code.ISP_INVOICE_NUMBER_OVERFLOW":
    "The next invoice number would be too long. Shorten the invoice prefix in Billing → Settings.",
  "code.ISP_BUYER_GSTIN_INVALID":
    "The customer's GSTIN is not valid. Check the 15 characters and try again.",
  "code.ISP_SELLER_GSTIN_INVALID":
    "Your GSTIN is not valid. Check the 15 characters in Billing → Settings.",
  "code.ISP_BULK_TOO_LARGE": "You can act on at most 500 invoices at once. Pick fewer invoices.",
  "code.ISP_NO_OVERDUE_INVOICES":
    "This customer has no overdue invoices, so there is nothing to remind them about.",
  "code.ISP_NO_RECIPIENT":
    "There is no email address on file for this choice. Add one, or pick another recipient.",
  "code.ISP_DEPOSIT_EXCEEDS_BALANCE":
    "A refund or forfeit cannot be more than the deposit held. Lower the amount.",
  "code.ISP_ZONE_CREDIT_EXCEEDED":
    "This would take the zone below its credit limit. Collect from the zone first, or raise its limit.",
  "code.ISP_DISCOUNT_INVALID": "This discount code cannot be used. Check the code, or remove it.",
  "code.ISP_DISCOUNT_UNKNOWN":
    "There is no discount code like this. Check the spelling with the subscriber, or remove it.",
  "code.ISP_DISCOUNT_OFF":
    "This discount code is switched off. Ask the subscriber for another code, or remove it.",
  "code.ISP_DISCOUNT_NOT_STARTED":
    "This discount code is not valid yet. Use it from its start date, or remove it.",
  "code.ISP_DISCOUNT_EXPIRED":
    "This discount code has expired. Ask the subscriber for another code, or remove it.",
  "code.ISP_DISCOUNT_USED_UP":
    "This coupon has been used up. Ask the subscriber for another code, or remove it.",
  "code.ISP_DISCOUNT_BELOW_MINIMUM":
    "The bill is below this code's minimum amount. Remove the code, or add to the bill.",
  "code.ISP_DISCOUNT_WRONG_PACKAGE":
    "This code does not work for this package. Remove it, or pick a package the code covers.",
  "code.ISP_DISCOUNT_NOTHING_TO_DISCOUNT":
    "There is nothing on this bill to discount. Remove the code.",
  "code.ISP_IDEMPOTENCY_KEY_REUSED":
    "This form was already used for a different entry. Close it, refresh the page and enter it again.",
  "code.ISP_PAY_LINK_NOT_FOUND":
    "This payment link is not valid or has expired. Ask your ISP for a new one.",
  "code.ISP_FINANCE_NOT_FOUND":
    "That item could not be found. It may have been deleted. Refresh the page.",
  "code.ISP_FINANCE_INVALID": "One of the values is not valid. Check the highlighted field.",
  "code.ISP_WALLET_EMPTY":
    "Your messaging credit is too low for this send. Ask Wyfy Guest to top it up.",
  "code.ISP_TARGET_REQUIRED": "Pick a subscriber or a customer (one of the two).",

  // -- collections ----------------------------------------------------------
  "code.ISP_COLLECTION_HANDOVER_NOT_FOUND": GONE("cash handover"),
  "code.ISP_COLLECTION_PROMISE_NOT_FOUND": GONE("promise to pay"),
  "code.ISP_COLLECTION_HANDOVER_STATE":
    "This handover was already approved or rejected. Refresh the page.",
  "code.ISP_COLLECTION_SELF_APPROVAL":
    "You cannot approve your own cash handover. Ask a manager to approve it.",
  "code.ISP_COLLECTION_NOTHING_TO_HAND_OVER":
    "You have no cash recorded on that day that is waiting for a handover.",

  // -- zones, fiber ---------------------------------------------------------
  "code.ISP_ZONE_NOT_FOUND": GONE("zone"),
  "code.ISP_ZONE_IN_USE":
    "This zone is still given to customers or subscribers. Move them to another zone first.",
  "code.ISP_ZONE_CYCLE":
    "A zone cannot be placed under itself or one of its own sub-zones. Pick a different parent.",
  "code.ISP_ZONE_HAS_CHILDREN": "This zone has sub-zones. Move or delete them first.",
  "code.ISP_FIBER_NOT_FOUND": GONE("fiber node"),
  "code.ISP_FIBER_INVALID":
    "That change does not fit this fiber node. Check the highlighted field.",
  "code.ISP_FIBER_CONFLICT": "That is already in use. Free it first, or pick another.",

  // -- apps: helpdesk, tasks, inventory, leads -----------------------------
  "code.ISP_APPS_NOT_FOUND":
    "That item could not be found. It may have been deleted. Refresh the page.",
  "code.ISP_APPS_CONFLICT": "That already exists. Use a different name or code.",
  "code.ISP_APPS_INVALID": "That change is not allowed. Check the details and try again.",
  "code.ISP_APPS_CHECKOUT_APPROVAL":
    "Giving a unit to a customer needs approval. Send a checkout request instead.",
  "code.ISP_STATUS_CHANGED":
    "This item's status has changed, so that step no longer fits. Refresh the page and try again.",

  // -- incidents, compliance, docs -----------------------------------------
  "code.ISP_INCIDENT_NOT_FOUND": GONE("incident"),
  "code.ISP_INCIDENT_STATE":
    "That step does not fit the incident's current status. Refresh the page.",
  "code.ISP_DOCUMENT_NOT_FOUND": GONE("document"),
  "code.ISP_CAF_NUMBER_TAKEN": "Another subscriber already has this CAF number. Check the number.",
  "code.ISP_DIAGNOSTICS_RATE_LIMITED":
    "Too many tests were started in the last minute. Wait a moment and try again.",

  // -- messaging and automation --------------------------------------------
  "code.ISP_AUTOMATION_ERROR": "Automation is not set up. Finish its settings first.",
  "code.ISP_WA_SENDER_NOT_CONNECTED":
    "Connect and verify your WhatsApp Business sender first (Messaging settings).",
  "code.ISP_WA_TEMPLATE_NOT_APPROVED":
    "That WhatsApp template is not approved yet. Pick an approved template.",
  "code.ISP_SENDER_IS_ISP_LEVEL":
    "This customer uses your ISP-wide sender. Change it in Messaging settings, or give this customer its own sender.",
  "code.ISP_BYO_OVERRIDE_NOT_ENABLED":
    "Per-customer senders are off for your account. Turn them on in Messaging settings first.",

  // -- TR-069 ---------------------------------------------------------------
  "code.TR069_DEVICE_NOT_FOUND": GONE("device"),
  "code.TR069_DISABLED_FOR_CUSTOMER":
    "TR-069 is switched off for this device's customer. Turn it on in the customer's TR-069 tab first.",
  "code.TR069_DISABLED_FOR_LOCATION":
    "TR-069 is switched off for this device's location. Turn it on for the location first.",
  "code.TR069_TASK_PENDING":
    "A task of this kind is already queued for this device. It runs when the device next checks in.",
  "code.TR069_ACS_UNAVAILABLE":
    "The device management server did not answer. Nothing was queued; try again in a minute.",

  // -- generic and field-level reasons -------------------------------------
  "code.ISP_ERROR": "The request could not be completed. Check the details and try again.",
  "code.ISP_BAD_REQUEST": "Some details are not valid. Check the form and try again.",
  "code.ISP_FIELD_IMMUTABLE": "This field cannot be changed after it is saved.",
  "code.ISP_QUERY_INVALID":
    "The page sent a value the server did not accept. Refresh the page and try again.",
  "code.ISP_CHOICE_INVALID": "Pick one of the listed options.",
  "code.ISP_DATE_FORMAT": "Enter a valid date.",
  "code.ISP_MONTH_FORMAT": "Pick a valid month.",
  "code.ISP_MONTH_IN_FUTURE": "Pick this month or an earlier one.",
  "code.ISP_DATE_RANGE_ORDER":
    "The end date is before the start date. Fix the dates and try again.",
  "code.ISP_DATE_RANGE_INCOMPLETE": "Pick both a start and an end date.",
  "code.ISP_DATE_RANGE_TOO_LONG": "Pick a range of {{max_days}} days or less.",
  "code.ISP_DATE_RANGE_INVALID":
    "Pick an end date after the start, at most {{max_days}} days apart.",
  "code.ISP_TIME_RANGE_TOO_LONG": "Pick a time range of {{max_hours}} hours or less.",
  "code.ISP_DAY_OF_MONTH_RANGE": "Pick a day between 1 and 28.",
  "code.ISP_VALUE_OUT_OF_RANGE": "Enter a value between {{min}} and {{max}}.",
  "code.ISP_EXPORT_TOO_LARGE":
    "That is too many rows for one file (at most {{max_rows}}). Pick a shorter date range.",
  "code.ISP_CSV_ONE_SECTION":
    "A CSV file holds one section. Pick a section, or download Excel instead.",
  "code.ISP_BULK_FILTER_TOO_BROAD":
    "This filter matches {{matched}} subscribers. Narrow it to {{max}} or fewer.",
  "code.RATE_LIMITED": "Too many attempts in a short time. Wait a minute and try again.",

  // -- fallbacks by status class -------------------------------------------
  "status.network": "Can't reach Wyfy Guest. Check your internet connection and try again.",
  "status.timeout": "The server took too long to answer. Try again.",
  "status.401": "Your session has ended. Sign in again.",
  "status.403": "You do not have permission to do this. Ask your ISP Owner or Admin.",
  "status.403_ability":
    "You do not have permission to {{ability}}. Ask your ISP Owner or Admin to give your role this permission.",
  "status.404": "That could not be found. It may have been deleted. Refresh the page.",
  "status.409": "This changed since you opened it. Refresh the page and try again.",
  "status.422": "Some details are not valid. Check the form and try again.",
  "status.429": "Too many attempts in a short time. Wait a minute and try again.",
  "status.4xx": "The request could not be completed. Check the details and try again.",
  "status.5xx":
    "Something went wrong on our side. Try again in a minute. If it keeps happening, share the reference with Wyfy Guest support.",
  "status.unknown": "Something went wrong. Try again.",

  // -- 422 field messages (Pydantic error types) ---------------------------
  "field.missing": "This is required.",
  "field.required": "This is required.",
  "field.string_too_short": "Too short.",
  "field.string_too_short_n": "Enter at least {{min_length}} characters.",
  "field.string_too_long": "Too long.",
  "field.string_too_long_n": "Enter at most {{max_length}} characters.",
  "field.string_pattern_mismatch": "This format is not valid.",
  "field.int_parsing": "Enter a whole number.",
  "field.int_from_float": "Enter a whole number.",
  "field.float_parsing": "Enter a number.",
  "field.decimal_parsing": "Enter a number.",
  "field.bool_parsing": "Pick yes or no.",
  "field.greater_than": "Must be more than {{gt}}.",
  "field.greater_than_equal": "Must be {{ge}} or more.",
  "field.less_than": "Must be less than {{lt}}.",
  "field.less_than_equal": "Must be {{le}} or less.",
  "field.too_short": "Add at least {{min_length}}.",
  "field.too_long": "At most {{max_length}} allowed.",
  "field.date_parsing": "Enter a valid date.",
  "field.date_from_datetime_parsing": "Enter a valid date.",
  "field.datetime_parsing": "Enter a valid date and time.",
  "field.datetime_from_date_parsing": "Enter a valid date and time.",
  "field.uuid_parsing": "Pick an item from the list.",
  "field.uuid_type": "Pick an item from the list.",
  "field.enum": "Pick one of the listed options.",
  "field.literal_error": "Pick one of the listed options.",
  "field.ip_v4_address": "Enter a valid IP address.",
  "field.ip_any_address": "Enter a valid IP address.",
  "field.value_error.email": "Enter a valid email address.",
  "field.extra_forbidden": "This field cannot be set here.",
  "field.invalid": "This value is not valid.",
  "field.named": "{{field}}: {{message}}",

  // -- labels around errors ------------------------------------------------
  "ui.retry": "Try again",
  "ui.refresh": "Refresh",
  "ui.copy_details": "Copy details",
  "ui.copied": "Details copied",
  "ui.reference": "Reference: {{id}}",
  "ui.couldnt_load": "Couldn't load {{what}}",
  "ui.no_access_title": "You do not have access",
  "ui.no_access":
    "Your role does not include {{what}}. Ask your ISP Owner or Admin if you need it.",
};

export type IspErrorTranslator = (key: string, vars?: Record<string, unknown>) => string | null;

let translator: IspErrorTranslator | null = null;

/** Plug in i18next (or anything) later; return null to fall back to English. */
export function setIspErrorTranslator(fn: IspErrorTranslator | null): void {
  translator = fn;
}

export function hasCopy(key: string): boolean {
  return key in ISP_ERROR_COPY_EN;
}

/** The text for `key` with `{{var}}` filled in. Unknown vars read as "…" so
 * a missing number never prints a raw placeholder. */
export function translate(key: string, vars: Record<string, unknown> = {}): string {
  const fromI18n = translator?.(key, vars);
  if (fromI18n) return fromI18n;
  const text = ISP_ERROR_COPY_EN[key] ?? "";
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
    vars[name] === undefined || vars[name] === null ? "…" : String(vars[name]),
  );
}

/**
 * What a permission key lets someone do, in words (403 "names the missing
 * ability"). Keys are `<area>.<action>`; anything not listed is described
 * from its parts.
 */
const AREA_WORDS: Record<string, string> = {
  isp_partner: "this ISP account",
  isp_customers: "customers",
  isp_subscribers: "subscribers",
  isp_plans: "plans and packages",
  isp_invoices: "invoices",
  isp_billing: "billing",
  isp_zones: "zones",
  isp_users: "staff users",
  isp_routers: "routers",
  isp_locations: "locations",
  isp_reports: "reports",
  isp_monitor: "monitoring",
  isp_apps: "helpdesk, tasks and inventory",
  isp_security: "security settings",
  isp_ops: "network tools",
  isp_compliance: "compliance records",
  isp_messaging: "messaging",
  isp_audit: "the activity log",
  tr069: "TR-069 devices",
};
const ACTION_WORDS: Record<string, string> = {
  read: "view",
  create: "add",
  update: "change",
  delete: "delete",
  manage: "manage",
  execute: "run actions on",
  export: "export",
  disconnect: "disconnect",
  kyc: "see KYC details of",
};

export function abilityLabel(permissionKey: string): string {
  const [area, action] = permissionKey.split(".");
  const what = AREA_WORDS[area] ?? area.replace(/^isp_/, "").replace(/_/g, " ");
  const verb = ACTION_WORDS[action] ?? (action ?? "use").replace(/_/g, " ");
  return `${verb} ${what}`;
}
