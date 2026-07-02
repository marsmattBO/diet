// ---------------------------------------------------------------------------
// Scoring weights (tunable)
// ---------------------------------------------------------------------------
const W1 = 3;    // ingredient reuse
const W2 = 1;    // novelty (avoid monotony)
const W3 = 1.5;  // meal-prep bonus
const W4 = 2;    // variety penalty

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function matchesTags(dish, prefs) {
  if (prefs.length === 0) return true;
  return prefs.every((p) => dish.tags.includes(p));
}

// Try full match, then progressively relax preferences instead of failing.
function relaxFilter(list, prefs) {
  let filtered = list.filter((d) => matchesTags(d, prefs));
  if (filtered.length > 0) return filtered;
  for (let n = prefs.length - 1; n >= 1; n--) {
    filtered = list.filter((d) => prefs.slice(0, n).every((p) => d.tags.includes(p)));
    if (filtered.length > 0) return filtered;
  }
  return list;
}

function ingredientNames(dish) {
  return dish.ingredients.map((i) => i.name);
}

function scoreDish(dish, ingredientPool, dishUsageCounter, isMealPrep) {
  const overlap = ingredientNames(dish).filter((n) => ingredientPool.has(n)).length;
  const usage = dishUsageCounter[dish.name] || 0;
  const novelty = 1 / (1 + usage);
  const mealPrepBonus = isMealPrep ? 1 : 0;
  const varietyPenalty = usage > 2 ? -2 : 0;
  const base = overlap * W1 + novelty * W2 + mealPrepBonus * W3 + varietyPenalty * W4;
  const rand = 1 + (Math.random() * 0.2 - 0.1); // +/-10%
  return base * rand;
}

function pickDish(candidates, ingredientPool, dishUsageCounter, isMealPrep) {
  if (!candidates || candidates.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const dish of candidates) {
    const s = scoreDish(dish, ingredientPool, dishUsageCounter, isMealPrep);
    if (s > bestScore) {
      bestScore = s;
      best = dish;
    }
  }
  return best;
}

function registerSelection(dish, ingredientPool, dishUsageCounter) {
  if (!dish) return;
  dishUsageCounter[dish.name] = (dishUsageCounter[dish.name] || 0) + 1;
  ingredientNames(dish).forEach((n) => ingredientPool.add(n));
}

// A "composed meal" for lunch/dinner = a Main + an independently chosen Veggie side.
function composeMainAndVeggie(mainList, veggieList, prefs, ingredientPool, dishUsageCounter, isMealPrep) {
  const mainCandidates = relaxFilter(mainList || [], prefs);
  const main = pickDish(mainCandidates, ingredientPool, dishUsageCounter, isMealPrep);
  registerSelection(main, ingredientPool, dishUsageCounter);

  const veggieCandidates = relaxFilter(veggieList || [], prefs);
  const veggie = pickDish(veggieCandidates, ingredientPool, dishUsageCounter, false);
  registerSelection(veggie, ingredientPool, dishUsageCounter);

  return { main, veggie };
}

function simpleMeal(list, prefs, ingredientPool, dishUsageCounter) {
  const candidates = relaxFilter(list || [], prefs);
  const dish = pickDish(candidates, ingredientPool, dishUsageCounter, false);
  registerSelection(dish, ingredientPool, dishUsageCounter);
  return dish;
}

function toOutputDish(dish) {
  if (!dish) return null;
  return {
    name: dish.name,
    ingredients: dish.ingredients.map((i) => ({ ...i })),
  };
}

export function generatePlan(data, config) {
  const ingredientPool = new Set();
  const dishUsageCounter = {};
  const weeklyPlan = [];
  const prefs = config.dietaryPreferences || [];

  DAYS.forEach((day, dayIndex) => {
    const dayPlan = { day };

    // Breakfast — simple, single dish
    dayPlan.breakfast = toOutputDish(simpleMeal(data.breakfast, prefs, ingredientPool, dishUsageCounter));

    // Lunch — main + veggie. First `workMealsPerWeek` weekdays pull the main
    // from the MealPrep worksheet (batch-cook), the rest from Lunch.
    const isWorkLunch = dayIndex < config.workMealsPerWeek;
    const lunchMainList = isWorkLunch ? data.mealPrep : data.lunch;
    dayPlan.lunch = composeMainAndVeggie(lunchMainList, data.veggies, prefs, ingredientPool, dishUsageCounter, isWorkLunch);
    dayPlan.lunch = { main: toOutputDish(dayPlan.lunch.main), veggie: toOutputDish(dayPlan.lunch.veggie) };

    // Dinner — main + veggie, always from the Dinner worksheet
    const dinnerPair = composeMainAndVeggie(data.dinner, data.veggies, prefs, ingredientPool, dishUsageCounter, false);
    dayPlan.dinner = { main: toOutputDish(dinnerPair.main), veggie: toOutputDish(dinnerPair.veggie) };

    // Snack — simple, single dish
    dayPlan.snack = toOutputDish(simpleMeal(data.snack, prefs, ingredientPool, dishUsageCounter));

    weeklyPlan.push(dayPlan);
  });

  return { weeklyPlan, groceries: buildGroceryList(weeklyPlan) };
}

// Quantity-aware aggregation: same ingredient + same unit sums; different
// units for the same ingredient are kept as separate lines (rare, but honest).
function buildGroceryList(weeklyPlan) {
  const totals = new Map(); // key: `${name}|${unit}` -> { name, unit, quantity, dishCount, numeric }

  function addIngredients(ingredients) {
    if (!ingredients) return;
    ingredients.forEach(({ name, quantity, unit }) => {
      const key = `${name}|${unit}`;
      const numeric = typeof quantity === "number" ? quantity : null;
      if (!totals.has(key)) {
        totals.set(key, { name, unit, quantity: numeric ?? quantity, occurrences: 1, numeric: numeric !== null });
      } else {
        const entry = totals.get(key);
        entry.occurrences += 1;
        if (entry.numeric && numeric !== null) {
          entry.quantity += numeric;
        } else {
          entry.numeric = false; // mixed/non-numeric, fall back to occurrence count only
        }
      }
    });
  }

  weeklyPlan.forEach((day) => {
    addIngredients(day.breakfast?.ingredients);
    addIngredients(day.lunch.main?.ingredients);
    addIngredients(day.lunch.veggie?.ingredients);
    addIngredients(day.dinner.main?.ingredients);
    addIngredients(day.dinner.veggie?.ingredients);
    addIngredients(day.snack?.ingredients);
  });

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Set of ingredient names used more than once across the week — for the
// "reused ingredient" highlight in the plan view.
export function reusedIngredientNames(groceries) {
  const s = new Set();
  groceries.forEach((g) => {
    if (g.occurrences > 1) s.add(g.name);
  });
  return s;
}
