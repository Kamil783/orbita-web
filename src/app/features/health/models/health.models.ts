export interface NutritionGoal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface FoodEntry {
  id: string;
  mealCategoryId: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  timestamp: number;
}

export interface MealCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export const DEFAULT_MEAL_CATEGORIES: MealCategory[] = [
  { id: 'breakfast', name: 'Завтрак', icon: 'wb_sunny', order: 0 },
  { id: 'lunch', name: 'Обед', icon: 'light_mode', order: 1 },
  { id: 'dinner', name: 'Ужин', icon: 'dark_mode', order: 2 },
];

export const DEFAULT_NUTRITION_GOAL: NutritionGoal = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
  fiber: 30,
};

export const MEAL_ICON_OPTIONS = [
  { icon: 'wb_sunny', label: 'Утро' },
  { icon: 'light_mode', label: 'День' },
  { icon: 'dark_mode', label: 'Вечер' },
  { icon: 'icecream', label: 'Перекус' },
  { icon: 'local_cafe', label: 'Кафе' },
  { icon: 'restaurant', label: 'Ресторан' },
  { icon: 'bakery_dining', label: 'Выпечка' },
  { icon: 'lunch_dining', label: 'Фастфуд' },
];
