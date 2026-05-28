// ─── Currency ───

export type CurrencyKind = 'fiat' | 'crypto';

export interface Currency {
  /** Primary key, 3..10 chars (e.g. 'RUB', 'USD', 'BTC', 'USDT'). */
  code: string;
  name: string;
  /** ISO-4217 numeric code, present for fiat currencies. */
  numCode?: number | null;
  kind: CurrencyKind;
  /**
   * How many RUB you get for `nominal` units of this currency.
   * For RUB always 1. `null` when no rate source — the currency cannot be
   * converted (newly added crypto, etc.).
   */
  rateToRub: number | null;
  /** Quote nominal — e.g. 100 JPY = N RUB → nominal: 100. Defaults to 1. */
  nominal: number;
  /** Unix-ms timestamp the rate was fetched at, `null` for RUB or stale. */
  rateFetchedAt: number | null;
}

// ─── Account ───

export interface Account {
  id: string;
  name: string;
  currencyCode: string;   // FK → Currency.code
  balance: number;        // decimal(28,8) on the server; native JS number here
}

// `/api/Accounts/total` response

export interface AccountsTotalItem {
  id: string;
  name: string;
  currencyCode: string;
  balance: number;
  /**
   * Balance converted to RUB using the currency's current rate.
   * `null` when the currency has no rate; such accounts are excluded from
   * `totalRub` server-side and we surface them as "Курс не найден" in the UI.
   */
  convertedRub: number | null;
}

export interface AccountsTotal {
  /** Sum of `convertedRub` over items where it's not null. */
  totalRub: number;
  items: AccountsTotalItem[];
}

// ─── DTOs ───

export interface CreateAccountDto {
  name: string;
  currencyCode: string;
  balance: number;
}

/** PATCH semantics: omitted/`null` means "don't touch". */
export interface UpdateAccountDto {
  name?: string;
  currencyCode?: string;
  balance?: number;
}
