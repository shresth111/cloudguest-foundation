/**
 * DEMO ONLY. The ten Wyfy system templates, copied verbatim from the backend
 * seed (cloud-guest-repo origin/main,
 * backend/alembic/versions/0134_create_guest_marketing_tables.py,
 * `SYSTEM_TEMPLATES`) so the demo shows exactly the wording a real account
 * gets. Imported only by ./demo-backend.ts, which is loaded only for a demo
 * session (see `useMarketingApi` in hooks/useMarketing.ts).
 *
 * Regenerate from the migration if the seed wording changes.
 */

export interface SeedTemplate {
  system_key: string;
  name: string;
  category: string;
  description: string;
  sms_body: string;
  whatsapp_body: string;
  whatsapp_variable_order: string[];
  email_subject: string;
  email_preheader: string;
  email_body_html: string;
}

export const SYSTEM_TEMPLATE_SEED: SeedTemplate[] = [
  {
    system_key: "welcome_back",
    name: "Welcome back",
    category: "welcome",
    sms_body:
      "Hi {{guest_name}}, thanks for visiting {{venue_name}} again! Show code {{offer_code}} on your next visit for a little treat. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "Hi {{guest_name}}, it was lovely to see you again at {{venue_name}}! 😊 As a thank-you, show the code *{{offer_code}}* on your next visit for a little treat on us. See you soon! Not interested? Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: ["guest_name", "venue_name", "offer_code", "unsubscribe_link"],
    email_subject: "Good to see you again, {{guest_name}}",
    email_preheader: "A small thank-you from {{venue_name}}",
    email_body_html:
      "<p>Hi {{guest_name}},</p><p>Thanks for coming back to {{venue_name}}. Regulars like you are the reason we do this.</p><p>Show the code <strong>{{offer_code}}</strong> on your next visit and we'll add a little something on the house.</p><p>See you soon,<br>Team {{venue_name}}</p><p><small>Don't want these emails? <a href=\"{{unsubscribe_link}}\">Unsubscribe</a>.</small></p>",
    description: "Thank returning guests and invite them back with a small treat.",
  },
  {
    system_key: "celebrate_with_us",
    name: "Birthdays & anniversaries",
    category: "birthday",
    sms_body:
      "Celebrating something, {{guest_name}}? Host your birthday or anniversary at {{venue_name}}. Code {{offer_code}} for a special deal. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "🎉 Got a birthday or anniversary coming up, {{guest_name}}? Celebrate it at {{venue_name}}! Use code *{{offer_code}}* when you book for a special celebration deal. Book here: {{booking_link}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "booking_link",
      "unsubscribe_link",
    ],
    email_subject: "Celebrate your special day at {{venue_name}}",
    email_preheader: "A special deal for birthdays and anniversaries",
    email_body_html:
      '<p>Hi {{guest_name}},</p><p>Birthday, anniversary or promotion coming up? Let {{venue_name}} host it.</p><p>Use <strong>{{offer_code}}</strong> when you book for a special celebration deal.</p><p><a href="{{booking_link}}">Book your table</a></p><p>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    description: "Invite guests to host a birthday or anniversary at your venue.",
  },
  {
    system_key: "weekend_offer",
    name: "Weekend offer",
    category: "offer",
    sms_body:
      "Weekend plans, {{guest_name}}? Use {{offer_code}} at {{venue_name}} this weekend. Valid till {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "Weekend plans, {{guest_name}}? ☀️ Spend them at {{venue_name}}! Show code *{{offer_code}}* for this weekend's special offer. Valid till {{offer_expiry}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "offer_expiry",
      "unsubscribe_link",
    ],
    email_subject: "This weekend at {{venue_name}}: an offer for you",
    email_preheader: "Code {{offer_code}}, valid till {{offer_expiry}}",
    email_body_html:
      '<p>Hi {{guest_name}},</p><p>Make this weekend a good one. Drop by {{venue_name}} and show the code <strong>{{offer_code}}</strong> for our weekend special.</p><p>Valid till {{offer_expiry}}.</p><p>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    description: "A weekend-only offer code with an expiry.",
  },
  {
    system_key: "feedback_request",
    name: "How was your visit?",
    category: "feedback",
    sms_body:
      "Hi {{guest_name}}, how was your visit to {{venue_name}}? Tell us in 1 min: {{review_link}} Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "Hi {{guest_name}}, thanks for visiting {{venue_name}}! 🙏 How did we do? It takes one minute: {{review_link}}. Your feedback helps us get better. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: ["guest_name", "venue_name", "review_link", "unsubscribe_link"],
    email_subject: "How was your visit to {{venue_name}}?",
    email_preheader: "One minute, one favour",
    email_body_html:
      '<p>Hi {{guest_name}},</p><p>Thanks for spending time at {{venue_name}}. We\'d love to know how it went, good or bad.</p><p><a href="{{review_link}}">Share your feedback</a> (takes about a minute)</p><p>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    description: "Ask recent guests how their visit went (uses your review link).",
  },
  {
    system_key: "festival_diwali",
    name: "Diwali greetings",
    category: "festival",
    sms_body:
      "Happy Diwali, {{guest_name}}! Celebrate with {{venue_name}}: use {{offer_code}} till {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "🪔 Happy Diwali, {{guest_name}}! Wishing you and your family light, joy and prosperity. Celebrate with us at {{venue_name}}: use code *{{offer_code}}* for a festive treat, valid till {{offer_expiry}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "offer_expiry",
      "unsubscribe_link",
    ],
    email_subject: "Happy Diwali from {{venue_name}} 🪔",
    email_preheader: "A festive treat, valid till {{offer_expiry}}",
    email_body_html:
      '<p>Dear {{guest_name}},</p><p>Wishing you and your loved ones a very happy Diwali, full of light, sweets and good company.</p><p>Celebrate with us at {{venue_name}}: use <strong>{{offer_code}}</strong> for a festive treat, valid till {{offer_expiry}}.</p><p>Warm wishes,<br>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    description: "Diwali greetings with a festive offer. Duplicate it for other festivals.",
  },
  {
    system_key: "happy_hour",
    name: "Happy hour",
    category: "offer",
    sms_body:
      "Happy hour at {{venue_name}}, {{guest_name}}! Show {{offer_code}} today. Valid till {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "⏰ It's happy hour at {{venue_name}}, {{guest_name}}! Show code *{{offer_code}}* today for happy-hour prices. Valid till {{offer_expiry}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "offer_expiry",
      "unsubscribe_link",
    ],
    email_subject: "Happy hour is on at {{venue_name}}",
    email_preheader: "Show {{offer_code}} today",
    email_body_html:
      '<p>Hi {{guest_name}},</p><p>Happy hour is on at {{venue_name}}. Show <strong>{{offer_code}}</strong> for happy-hour prices, valid till {{offer_expiry}}.</p><p>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    description: "Announce happy-hour prices for today.",
  },
  {
    system_key: "loyalty_reward",
    name: "Loyalty reward",
    category: "loyalty",
    sms_body:
      "Thank you for being a regular, {{guest_name}}! Your reward at {{venue_name}}: code {{offer_code}}, valid till {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "🌟 {{guest_name}}, you're one of our regulars at {{venue_name}}, and we noticed! Here's a reward just for you: code *{{offer_code}}*, valid till {{offer_expiry}}. Thank you for your loyalty! Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "offer_expiry",
      "unsubscribe_link",
    ],
    email_subject: "A thank-you reward for you, {{guest_name}}",
    email_preheader: "Because you keep coming back",
    email_body_html:
      "<p>Hi {{guest_name}},</p><p>You've visited {{venue_name}} more than most, and that means a lot to us.</p><p>Here's a reward: <strong>{{offer_code}}</strong>, valid till {{offer_expiry}}.</p><p>Thank you,<br>Team {{venue_name}}</p><p><small><a href=\"{{unsubscribe_link}}\">Unsubscribe</a></small></p>",
    description: "Reward your regulars with a thank-you code.",
  },
  {
    system_key: "event_invite",
    name: "Event invitation",
    category: "event",
    sms_body:
      "{{guest_name}}, you're invited: {{event_name}} at {{venue_name}} on {{event_date}}. Book: {{booking_link}} Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "📅 {{guest_name}}, you're invited! Join us for *{{event_name}}* at {{venue_name}} on {{event_date}}. Spots are limited. Reserve yours: {{booking_link}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "event_name",
      "venue_name",
      "event_date",
      "booking_link",
      "unsubscribe_link",
    ],
    email_subject: "You're invited: {{event_name}} at {{venue_name}}",
    email_preheader: "{{event_date}}. Spots are limited",
    email_body_html:
      '<p>Hi {{guest_name}},</p><p>We\'re hosting <strong>{{event_name}}</strong> at {{venue_name}} on {{event_date}}, and we\'d love to see you there.</p><p><a href="{{booking_link}}">Reserve your spot</a></p><p>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    description: "Invite guests to an event with a booking link.",
  },
  {
    system_key: "win_back",
    name: "We miss you",
    category: "winback",
    sms_body:
      "We miss you, {{guest_name}}! Come back to {{venue_name}} and use {{offer_code}} before {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "Hi {{guest_name}}, it's been a while! 👋 We miss having you at {{venue_name}}. Come back and use code *{{offer_code}}* for a welcome-back offer, valid till {{offer_expiry}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "offer_expiry",
      "unsubscribe_link",
    ],
    email_subject: "We miss you at {{venue_name}}",
    email_preheader: "A welcome-back offer inside",
    email_body_html:
      "<p>Hi {{guest_name}},</p><p>It's been a while since your last visit to {{venue_name}}, and we'd love to see you again.</p><p>Use <strong>{{offer_code}}</strong> for a welcome-back offer, valid till {{offer_expiry}}.</p><p>Team {{venue_name}}</p><p><small><a href=\"{{unsubscribe_link}}\">Unsubscribe</a></small></p>",
    description: "Bring back guests you have not seen in a while.",
  },
  {
    system_key: "new_arrival",
    name: "Something new",
    category: "announcement",
    sms_body:
      "Something new at {{venue_name}}, {{guest_name}}! Try it with code {{offer_code}} till {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
    whatsapp_body:
      "✨ Something new has arrived at {{venue_name}}, {{guest_name}}! Be among the first to try it. Show code *{{offer_code}}* for an introductory offer, valid till {{offer_expiry}}. Unsubscribe: {{unsubscribe_link}}",
    whatsapp_variable_order: [
      "guest_name",
      "venue_name",
      "offer_code",
      "offer_expiry",
      "unsubscribe_link",
    ],
    email_subject: "New at {{venue_name}}: be the first to try it",
    email_preheader: "An introductory offer for our regulars",
    email_body_html:
      "<p>Hi {{guest_name}},</p><p>We've just launched something new at {{venue_name}}, and you're among the first to hear about it.</p><p>Come try it and show <strong>{{offer_code}}</strong> for an introductory offer, valid till {{offer_expiry}}.</p><p>Team {{venue_name}}</p><p><small><a href=\"{{unsubscribe_link}}\">Unsubscribe</a></small></p>",
    description: "Announce something new with an introductory offer.",
  },
];
