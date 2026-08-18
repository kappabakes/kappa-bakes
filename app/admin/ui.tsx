"use client";

/** Shared pieces so every admin screen looks like the same product. */

export const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    className={`rounded-card border border-line bg-paper p-5 shadow-soft ${className}`}
  >
    {children}
  </section>
);

export function PageHead({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        {note && <p className="mt-1 text-sm text-ink2">{note}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "navy" | "gold" | "outline" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
  title?: string;
};

export function Btn({
  children,
  onClick,
  variant = "navy",
  disabled,
  className = "",
  title,
}: BtnProps) {
  const styles: Record<string, string> = {
    navy: "bg-navy text-white hover:bg-navy-hover",
    gold: "bg-gold text-white hover:bg-gold-hover",
    outline: "border border-navy bg-paper text-navy hover:bg-cream-beige",
    danger: "border border-bad bg-paper text-bad hover:bg-bad-light",
    ghost: "border border-line bg-paper text-ink2 hover:bg-cream-beige",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-btn px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  className = "",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
      />
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
      />
    </label>
  );
}

export const Tag = ({
  children,
  tone = "beige",
}: {
  children: React.ReactNode;
  tone?: "beige" | "good" | "warn" | "bad" | "gold";
}) => {
  const tones: Record<string, string> = {
    beige: "bg-cream-beige text-ink2",
    good: "bg-good-light text-good",
    warn: "bg-warn-light text-[#C56C00]",
    bad: "bg-bad-light text-bad",
    gold: "bg-gold-light text-gold-hover",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:py-1 sm:text-[12px] ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

/** Toggle chip, used for allergens. */
export const Chip = ({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={[
      "whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors sm:px-3 sm:text-[13px]",
      on
        ? "bg-navy text-white"
        : "bg-cream-beige text-ink2 hover:bg-cream-warm",
    ].join(" ")}
  >
    {children}
  </button>
);

/**
 * Every admin screen calls this after a failed fetch. A 401 means the session
 * cookie didn't stick — which used to show as empty panels with no
 * explanation, so it says so plainly and sends you back to sign in.
 */
export async function readError(r: Response): Promise<string> {
  if (r.status === 401) {
    // Give the message a moment to be read before the page reloads.
    setTimeout(() => window.location.reload(), 2500);
    return "You're not signed in — the session didn't stick. Signing you out.";
  }

  const text = await r.text();
  try {
    return JSON.parse(text).error ?? text;
  } catch {
    return `${r.status}: ${text.slice(0, 120)}`;
  }
}
