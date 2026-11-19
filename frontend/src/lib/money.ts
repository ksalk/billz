export const MAX_AMOUNT_MINOR = 9_999_999_999;

const fractionDigitsCache = new Map<string, number>();

export function currencyFractionDigits(currency: string): number {
  const cached = fractionDigitsCache.get(currency);

  if (cached !== undefined) {
    return cached;
  }

  let digits = 2;

  try {
    digits =
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }

  fractionDigitsCache.set(currency, digits);
  return digits;
}

export function formatMinor(amountMinor: number, currency: string): string {
  const factor = 10 ** currencyFractionDigits(currency);

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amountMinor / factor);
}

export function parseAmountToMinor(
  raw: string,
  currency: string,
): number | null {
  const digits = currencyFractionDigits(currency);
  const value = raw.trim().replace(/\s+/g, "");

  if (digits === 0) {
    if (!/^\d+$/.test(value)) {
      return null;
    }
  } else if (!new RegExp(`^\\d+(?:[.,]\\d{1,${digits}})?$`).test(value)) {
    return null;
  }

  const [whole, fraction = ""] = value.split(/[.,]/);
  const scale = 10 ** digits;
  const minor =
    Number(whole) * scale +
    Number(`${fraction}${"0".repeat(digits)}`.slice(0, digits));

  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_AMOUNT_MINOR) {
    return null;
  }

  return minor;
}

export function minorToInput(amountMinor: number, currency: string): string {
  const digits = currencyFractionDigits(currency);

  if (digits === 0) {
    return String(amountMinor);
  }

  const factor = 10 ** digits;
  const whole = Math.trunc(amountMinor / factor);
  const fraction = String(amountMinor % factor).padStart(digits, "0");

  return `${whole}.${fraction}`;
}
