// Brand, links and fixed rules. The MENU and COLLECTION DAYS are not here —
// they're managed in /admin so you never need a deploy to change them.

export const SHOP = {
  name: "Kappa Bakes",
  tagline: "Burnt on purpose.",
  welcome:
    "San Sebastián cheesecake, baked to order and sold by the slice. When they're gone, they're gone.",
  addressLines: ["95 Woodfield Avenue", "Batley", "West Yorkshire", "WF17 7DU"],
  postcode: "WF17 7DU",
  email: "orders@kappabakes.com",
  /// Drop your logo at public/logo.png (square, transparent background).
  logo: "/logo.png",
};

export const SOCIALS = {
  instagram: {
    handle: "@kappa.bakes",
    url: "https://instagram.com/kappa.bakes",
  },
  snapchat: {
    /// TODO: put your real Snapchat username here
    handle: "@kappabakes",
    url: "https://snapchat.com/add/kappabakes",
  },
  whatsapp: {
    /// International format, no plus. Empty string hides every WhatsApp link.
    number: "447783139908",
  },
};

export const whatsappLink = (text?: string) =>
  SOCIALS.whatsapp.number
    ? `https://wa.me/${SOCIALS.whatsapp.number}${
        text ? `?text=${encodeURIComponent(text)}` : ""
      }`
    : null;

/**
 * Payment marks shown in the footer. Drop the official SVGs into
 * public/cards/ and they'll be used; until then each falls back to a plain
 * text chip, which is honest and costs nothing.
 *
 * Only list what your Stripe account actually accepts — American Express and
 * the wallets are settings you turn on, not automatic.
 */
export const CARDS = [
  { id: "visa", label: "Visa", icon: "/cards/visa.svg" },
  { id: "mastercard", label: "Mastercard", icon: "/cards/mastercard.svg" },
  { id: "amex", label: "Amex", icon: "/cards/amex.svg" },
  { id: "applepay", label: "Apple Pay", icon: "/cards/apple-pay.svg" },
  { id: "googlepay", label: "Google Pay", icon: "/cards/google-pay.svg" },
] as const;

/** Defaults for a newly created collection day. */
export const DEFAULT_CAPACITY = 32;
export const DEFAULT_START = "2:00 PM";
export const DEFAULT_END = "4:00 PM";
export const SLICES_PER_CAKE = 8;

/**
 * Default only — the live value lives in Settings and is editable in /admin.
 * Use maxPerOrder() from lib/settings.ts rather than this.
 */
export const DEFAULT_MAX_PER_ORDER = 2;

/**
 * You can order N slices only while at least N + TAIL_RESERVE remain.
 * 0 means no step-down — the reservation below already prevents overselling.
 */
export const TAIL_RESERVE = 0;

/** How long a checkout holds its slices before they go back on sale. */
/**
 * How long slices are held while someone is paying.
 *
 * Stripe won't create a checkout session that expires in under 30 minutes, so
 * this can't go lower — the hold and the payment page have to run out at the
 * same moment, or slices would be released while the customer is still on
 * Stripe's page and able to pay.
 */
export const RESERVATION_MINUTES = 30;

/** Default cut-off for a generated day: the evening before, at this hour. */
export const CUTOFF_HOUR_BEFORE = 18;

/**
 * How far ahead the weekly schedule generates dates. One week: you set the
 * dates each Monday, so anything further out is noise.
 */
export const HORIZON_WEEKS = 1;

/** Both notices carry their heading, so they read the same everywhere they
 *  appear — order page, Stripe checkout, confirmation email, order record. */
/**
 * How long an order is held past the end of the collection window.
 *
 * GRACE_MINUTES applies when you've heard nothing. LATE_GRACE_MINUTES is the
 * longer hold, and only if they've been in touch before their window closes —
 * contact is what earns it.
 *
 * Declared here, above the wording that quotes them.
 */
/**
 * Asked for in both the confirmation and the reminder. Toppings go on fresh
 * at collection, and a few minutes' warning is the difference between them
 * sitting properly and sliding off before someone gets home.
 */
export const HEADS_UP_NOTE =
  "When you're 2-3 minutes away, please message us on WhatsApp so we can add " +
  "your toppings. They go on fresh, and this keeps them from sliding before " +
  "you get home.";

export const GRACE_MINUTES = 15;
export const LATE_GRACE_MINUTES = 30;

export const NO_SHOW_HEADING = "No-Show Policy:";
export const NO_SHOW_BODY =
  "Slices are baked to order, so payment isn't refundable if you don't " +
  "collect. If you're running late, message us before your slot ends — we can " +
  `hold your order up to ${LATE_GRACE_MINUTES} minutes after it. Without ` +
  `contact, it's a no-show ${GRACE_MINUTES} minutes after your slot ends. ` +
  "Orders can't be moved to another day.";
export const NO_SHOW_POLICY = `${NO_SHOW_HEADING} ${NO_SHOW_BODY}`;

/**
 * The short form, for the tick box at checkout and Stripe's payment page.
 *
 * Kept brief so it's actually read, and pointing at the FAQ for the rest.
 * This is also what's snapshotted onto the order record, because a record of
 * what someone accepted has to be the words they were shown.
 */
export const NO_SHOW_SHORT_BODY =
  "Slices are baked to order, so payment isn't refundable if you don't " +
  "collect. If you're running late, message us before your slot ends. See " +
  "full policy in the FAQ's section.";
export const NO_SHOW_SHORT = `${NO_SHOW_HEADING} ${NO_SHOW_SHORT_BODY}`;

/**
 * How long an order is held past the end of the collection window before it
 * counts as a no-show. Kept separate so the short notice stays short — this
 * line goes in the confirmation email and the terms, not on the tick box.
 */
/**
 * How long before a date's cut-off the "running low" email goes out. Tied to
 * the cut-off rather than a day of the week, because a nudge is only useful
 * while there's still time to order.
 */
export const NUDGE_HOURS_BEFORE_CUTOFF = 5;


/**
 * The cancellation deadline. A fixed clock time is easier to hold people to
 * than a rolling 24 hours — it's the same for everyone, and it's the point
 * at which you're buying ingredients for the next day's bake.
 */
export const CANCEL_DEADLINE = "12pm (noon) the day before your collection date";
export const GRACE_NOTE =
  `We can hold your order for ${GRACE_MINUTES} minutes after your collection ` +
  `window ends. If you need longer than that, message us before the window ` +
  `closes and we can hold it up to ${LATE_GRACE_MINUTES} minutes after — but ` +
  `not beyond that. Either way, once the hold runs out it's a no-show and, ` +
  `as set out in the terms, isn't refundable. Orders can't be moved to a ` +
  `different day.`;

export const ALLERGEN_HEADING = "Allergens Disclaimer:";
export const ALLERGEN_BODY =
  "Everything is made in a home kitchen that handles milk, eggs, wheat, nuts and soya. " +
  "We can't guarantee any slice is free from traces of an allergen, even where it isn't listed.";
export const ALLERGEN_NOTICE = `${ALLERGEN_HEADING} ${ALLERGEN_BODY}`;

/**
 * The 14 UK regulated allergens. You can add your own in /admin — those are
 * stored in Settings and merged with this list, so adding one to a flavour
 * makes it available to every flavour without selecting it anywhere else.
 */
export const ALLERGENS = [
  { id: "milk", label: "Milk" },
  { id: "eggs", label: "Eggs" },
  { id: "gluten", label: "Cereals containing gluten" },
  { id: "nuts", label: "Tree nuts" },
  { id: "peanuts", label: "Peanuts" },
  { id: "soya", label: "Soya" },
  { id: "sesame", label: "Sesame" },
  { id: "sulphites", label: "Sulphur dioxide / sulphites" },
  { id: "lupin", label: "Lupin" },
  { id: "celery", label: "Celery" },
  { id: "mustard", label: "Mustard" },
  { id: "fish", label: "Fish" },
  { id: "crustaceans", label: "Crustaceans" },
  { id: "molluscs", label: "Molluscs" },
] as const;

export const allergenLabel = (id: string) =>
  ALLERGENS.find((a) => a.id === id)?.label ?? id;

/**
 * Extra sauce on a flavour that already comes with one. A tub costs more than
 * a drizzle over the slice — it's more sauce and a container.
 */
export const EXTRA_SAUCE_ON_SLICE_PENCE = 50;
export const EXTRA_SAUCE_TUB_PENCE = 100;

/** Kept for older code paths; the on-the-slice price. */
export const EXTRA_SAUCE_PENCE = EXTRA_SAUCE_ON_SLICE_PENCE;

/** What extra sauce costs, given where it's going. */
export const extraSaucePence = (placement: string | null | undefined) =>
  placement === "in a tub" || placement === "separately"
    ? EXTRA_SAUCE_TUB_PENCE
    : EXTRA_SAUCE_ON_SLICE_PENCE;

export const TOPPING_CHOICES = [
  { id: "on the slice", label: "On the slice" },
  { id: "separately", label: "Separately" },
] as const;

export const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const dayLabel = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

export const shortDay = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "1d 3h 20m" — the format the countdown uses. */
export function countdown(ms: number): string {
  if (ms <= 0) return "0d 0h 0m";
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h ${m % 60}m`;
}


/** DD/MM/YYYY — matches how dates read in the admin, so an order is quick to
 *  find when someone messages about it. */
export const ukDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * The message a customer sends about an existing order. Each detail on its
 * own line so it can be read at a glance.
 */
export function orderQuery(o: {
  orderNo: string;
  lastName: string;
  day: Date | string;
}) {
  return whatsappLink(
    [
      "Hi, I have a query regarding my order.",
      `Order Number: ${o.orderNo}`,
      `Last Name: ${o.lastName}`,
      `Collection Date: ${ukDate(o.day)}`,
    ].join("\n")
  );
}
