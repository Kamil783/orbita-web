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

// ─── Account transactions ───

/**
 * A single operation against an Account. The sign of `amount` carries the
 * direction (just like FinanceTransaction): negative = expense, positive = income.
 *
 * Stored on the server under `/api/Accounts/transactions`. Each create / update /
 * delete is atomic with the corresponding `Account.Balance` change.
 */
export interface AccountTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  title: string;
  amount: number;          // signed, in the account's native currency (decimal, not kopecks)
  date: string;            // ISO date 'YYYY-MM-DD'
  timestamp: number;       // ms since epoch
}

export interface CreateAccountTransactionDto {
  accountId: string;
  title: string;           // 1..200
  /** Signed; must be non-zero. Server applies `Balance += amount` atomically. */
  amount: number;
  categoryId: string | null;
  /** ISO datetime. `null` → server uses `DateTime.UtcNow`. */
  date: string | null;
}

/**
 * PATCH semantics, exactly as documented on the server:
 *   - `title`, `amount`, `date`: `null` (or omitted) means "don't touch".
 *   - `categoryId`: ALWAYS applied when present in the body — `null` clears the
 *     category, a guid replaces it. Omit the key to leave it untouched.
 *
 * Changing `amount` re-runs the same atomic balance adjustment by
 * `(newAmount − oldAmount)`. Changing the source account is not supported by
 * the server.
 */
export interface UpdateAccountTransactionDto {
  title?: string | null;
  amount?: number | null;
  categoryId?: string | null;
  date?: string | null;
}
