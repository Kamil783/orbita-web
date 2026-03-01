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

export interface Transaction {
  id: string;
  categoryId: string;
  title: string;
  date: string;
  amount: number;       // kopecks, negative = expense, positive = income
  timestamp: number;    // ms since epoch
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

// ─── Request DTOs ───

export interface CreateCategoryDto {
  name: string;
  icon: string;
  bg: string;
  color: string;
  weeklyLimit?: number;
  monthlyLimit?: number;
}

export interface CreateTransactionDto {
  categoryId: string;
  title: string;
  amount: number;       // kopecks, signed
}

export interface CreateSavingsGoalDto {
  name: string;
  target: number;       // kopecks
}

export interface AdjustBalanceDto {
  amount: number;       // kopecks, signed delta
}

// ─── Response models ───

export interface BalanceResponse {
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
