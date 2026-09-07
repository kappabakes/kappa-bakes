/**
 * What's accepted, as small marks. Drawn inline rather than loaded as images —
 * no extra requests, crisp at any size, nothing hotlinked.
 *
 * This row is a statement of what Stripe will take. Which wallet actually
 * appears at checkout is decided by Stripe from the customer's device: Apple
 * Pay on iOS and macOS, Google Pay on Android and Chrome, cards everywhere.
 */

const Pill = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <li>
    <span
      title={label}
      aria-label={label}
      className="flex h-6 min-w-[40px] items-center justify-center rounded-[4px] bg-white px-1.5"
    >
      {children}
    </span>
  </li>
);

const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden>
    <path d="M17.6 12.7c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.1ZM15.7 6.2c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1Z" />
  </svg>
);

const GoogleGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" aria-hidden>
    <path fill="#4285F4" d="M21.6 12.2c0-.6 0-1.2-.2-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC04" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6A6 6 0 0 1 12 5.9Z" />
  </svg>
);

export function PaymentMarks() {
  return (
    <ul
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Payment methods accepted"
    >
      <Pill label="Apple Pay">
        <span className="flex items-center gap-0.5 text-[10px] leading-none text-ink">
          <AppleGlyph />
          Pay
        </span>
      </Pill>

      <Pill label="Google Pay">
        <span className="flex items-center gap-0.5 text-[10px] leading-none text-ink">
          <GoogleGlyph />
          Pay
        </span>
      </Pill>

      <Pill label="Visa">
        <span className="font-display text-[11px] italic leading-none tracking-tight text-[#1A1F71]">
          VISA
        </span>
      </Pill>

      <Pill label="Visa Debit">
        <span className="flex items-baseline gap-0.5 leading-none">
          <span className="font-display text-[11px] italic tracking-tight text-[#1A1F71]">
            VISA
          </span>
          <span className="text-[6px] font-bold uppercase tracking-wide text-[#1A1F71]">
            Debit
          </span>
        </span>
      </Pill>

      <Pill label="Mastercard">
        <svg viewBox="0 0 40 24" className="h-3.5 w-auto" aria-hidden>
          <circle cx="15" cy="12" r="9" fill="#EB001B" />
          <circle cx="25" cy="12" r="9" fill="#F79E1B" fillOpacity="0.9" />
        </svg>
      </Pill>

      <Pill label="Maestro">
        <svg viewBox="0 0 40 24" className="h-3.5 w-auto" aria-hidden>
          <circle cx="15" cy="12" r="9" fill="#0099DF" />
          <circle cx="25" cy="12" r="9" fill="#ED0006" fillOpacity="0.9" />
        </svg>
      </Pill>

      <Pill label="American Express">
        <span className="font-display text-[8px] font-bold leading-none text-[#006FCF]">
          AMEX
        </span>
      </Pill>
    </ul>
  );
}
