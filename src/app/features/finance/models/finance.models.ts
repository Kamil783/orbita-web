// ─── Domain models ───

export interface Category {
  id: string;
  name: string;
  icon: string;
  bg: string;
  color: string;
  weeklyLimit?: number;  // kopecks, 0 or undefined = not set
  monthlyLimit?: number; // kopecks, 0 or undefined = not set
}

/**
 * Transaction "wallet" — which budget the operation belongs to.
 *
 * - `personal` — личные деньги пользователя (никак не влияют на общий баланс).
 * - `shared`   — общий баланс (пара/семья); списывается с `/api/Finance/balance`.
 * - `team`     — командный бюджет (рабочая команда, общий проект и т.п.).
 *
 * For backwards compatibility creation/update DTOs still send `fromBalance`
 * (`true` ⇔ `shared`, `false` ⇔ `personal`) — the server may map it to
 * `transactionType` on the way in. Responses always include `transactionType`.
 */
export type TransactionType = 'personal' | 'shared' | 'team';

export interface Transaction {
  id: string;
  categoryId: string;
  title: string;
  date: string;
  amount: number;             // kopecks, negative = expense, positive = income
  timestamp: number;          // ms since epoch
  /** Wallet/source of the transaction (new field — preferred). */
  transactionType: TransactionType;
  /**
   * Legacy boolean kept for backwards compatibility on older responses.
   * `true` = shared, `false` = personal. Prefer `transactionType` when available.
   */
  fromBalance?: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;       // kopecks
  current: number;      // kopecks
}

export interface SpendingLimits {
  monthlyLimit: number; // kopecks, 0 = not set
  weeklyLimit: number;  // kopecks, 0 = not set
}

export interface ChartDataPoint {
  label: string;
  value: number;        // rubles
}

// ─── Recurring (mandatory) payments ───

export interface RecurringPayment {
  id: string;
  title: string;
  amount: number;        // kopecks, positive (expense amount)
  dayOfMonth: number;    // 1..31, due day each month
  categoryId?: string;   // optional link to category
}

export interface CreateRecurringPaymentDto {
  title: string;
  amount: number;        // kopecks, positive
  dayOfMonth: number;    // 1..31
  categoryId?: string;
}

export interface UpdateRecurringPaymentDto {
  title?: string;
  amount?: number;       // kopecks, positive
  dayOfMonth?: number;   // 1..31
  categoryId?: string | null;
}

// ─── Shopping list ───

export type ShoppingListType = 'personal' | 'shared' | 'team';

export interface ShoppingListItem {
  id: string;
  name: string;
  price: number | null;  // kopecks, null = unknown
  bought: boolean;
  order: number;         // position within the list (asc)
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  createdAt: number;     // ms since epoch
  listType: ShoppingListType;
  pinned: boolean;       // pinned lists are always shown on top
}

// ─── Planned purchases (monthly purchase plan) ───

export type PlannedPurchaseStatus = 'planned' | 'bought' | 'cancelled';

export interface PlannedPurchase {
  id: string;
  title: string;
  date: string;                   // ISO 'YYYY-MM-DD' — planned purchase date
  amount: number;                 // kopecks, expected expense (positive)
  assigneeId: string | null;      // team member id, null = unassigned
  categoryId: string | null;
  note: string;                   // optional details, '' if not set
  status: PlannedPurchaseStatus;
  createdAt: number;              // ms since epoch
}

export interface CreatePlannedPurchaseDto {
  title: string;
  date: string;                   // ISO 'YYYY-MM-DD'
  amount: number;                 // kopecks, positive
  assigneeId?: string | null;
  categoryId?: string | null;
  note?: string;
}

export interface UpdatePlannedPurchaseDto {
  title?: string;
  date?: string;                  // ISO 'YYYY-MM-DD'
  amount?: number;                // kopecks, positive
  assigneeId?: string | null;
  categoryId?: string | null;
  note?: string;
  status?: PlannedPurchaseStatus;
}

// ─── Request DTOs ───

export interface CreateCategoryDto {
  name: string;
  icon: string;
  bg: string;
  color: string;
  weeklyLimit?: number;
  monthlyLimit?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  icon?: string;
  bg?: string;
  color?: string;
  weeklyLimit?: number;
  monthlyLimit?: number;
}

export interface CreateTransactionDto {
  categoryId: string;
  title: string;
  amount: number;       // kopecks, signed
  fromBalance: boolean; // true = deduct from balance, false = external source
  date?: string;        // ISO date 'YYYY-MM-DD', defaults to today on backend
}

export interface UpdateTransactionDto {
  categoryId?: string | null;
  title?: string;
  amount?: number;      // kopecks, signed
  fromBalance?: boolean;
  date?: string;        // ISO date 'YYYY-MM-DD'
}

export interface CreateSavingsGoalDto {
  name: string;
  target: number;       // kopecks
}

export interface FundSavingsGoalDto {
  amount: number;       // kopecks, positive delta
}

export interface UpdateSavingsGoalDto {
  name?: string;
  target?: number;       // kopecks
}

export interface WithdrawSavingsGoalDto {
  amount: number;       // kopecks, positive value to withdraw
}

export interface CreateShoppingListDto {
  name: string;
  /**
   * Wallet source for the list, analogous to a transaction.
   *   `false` → personal список,
   *   `true`  → shared (общий) список.
   * Team-type lists are created via a separate workspace flow, not from this DTO.
   * The server is responsible for mapping `fromBalance` → `listType`.
   */
  fromBalance: boolean;
}

export interface CreateShoppingListItemDto {
  name: string;
  price: number | null;   // kopecks, null = unknown
}

export interface UpdateShoppingListItemDto {
  name?: string;
  price?: number | null;  // kopecks, null = unknown
}

export interface UpdateShoppingListDto {
  name?: string;
  pinned?: boolean;
  listType?: ShoppingListType;
}

export interface ReorderShoppingListItemsDto {
  itemIds: string[]; // new order, top → bottom
}

export interface ToggleShoppingListItemDto {
  bought: boolean;
}

export interface AdjustBalanceDto {
  amount: number;       // kopecks, signed delta
}

// ─── Response models ───

export interface BalanceResponse {
  balance: number;      // kopecks
}

export interface PreviousMonthBalanceResponse {
  balance: number;      // kopecks
}

// ─── UI constants ───

export const ICON_OPTIONS: { icon: string; label: string }[] = [
  { icon: 'restaurant', label: 'Еда' },
  { icon: 'shopping_bag', label: 'Покупки' },
  { icon: 'directions_car', label: 'Транспорт' },
  { icon: 'home', label: 'Жильё' },
  { icon: 'local_hospital', label: 'Здоровье' },
  { icon: 'school', label: 'Образование' },
  { icon: 'sports_esports', label: 'Развлечения' },
  { icon: 'checkroom', label: 'Одежда' },
  { icon: 'pets', label: 'Питомцы' },
  { icon: 'flight', label: 'Путешествия' },
  { icon: 'payments', label: 'Зарплата' },
  { icon: 'savings', label: 'Накопления' },
  { icon: 'subscriptions', label: 'Подписки' },
  { icon: 'fitness_center', label: 'Спорт' },
  { icon: 'coffee', label: 'Кофе' },
  { icon: 'redeem', label: 'Подарки' },
];

export const COLOR_OPTIONS: { bg: string; color: string }[] = [
  { bg: '#fff7ed', color: '#ea580c' },
  { bg: '#eff6ff', color: '#2563eb' },
  { bg: '#f0fdf4', color: '#16a34a' },
  { bg: '#faf5ff', color: '#9333ea' },
  { bg: '#fefce8', color: '#a16207' },
  { bg: '#fef2f2', color: '#dc2626' },
  { bg: '#f0f9ff', color: '#0891b2' },
  { bg: '#fdf2f8', color: '#db2777' },
];
