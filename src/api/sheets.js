import { SHEET_ID, OPENSHEET_BASE, SHEET_TABS } from "../config.js";

// ---------------------------------------------------------------------------
// Sheet format (long / tidy — one row per ingredient):
//
//   dish_name          | ingredient    | quantity | unit | tags
//   --------------------------------------------------------------
//   Greek Yogurt Bowl   | greek yogurt  | 200      | g    | vegetarian
//   Greek Yogurt Bowl   | oats          | 40       | g    | vegetarian
//   Greek Yogurt Bowl   | honey         | 1        | tbsp | vegetarian
//
// - Repeat dish_name on every row belonging to that dish.
// - tags can be repeated on every row or only the first row for that dish —
//   both work, they get merged/deduped per dish either way.
// - tags cell itself is comma-separated for multiple tags:
//   "vegetarian, gluten-free"
// - quantity is optional (defaults to 1), unit is optional (defaults to "").
// ---------------------------------------------------------------------------

function parseTags(cell) {
  if (!cell || typeof cell !== "string") return [];
  return cell
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// Groups long-format rows (one per ingredient) into dish objects:
// { name, ingredients: [{ name, quantity, unit }], tags: [...] }
function groupRowsIntoDishes(rows) {
  const dishMap = new Map(); // dish_name -> dish object, preserves first-seen order

  rows.forEach((r) => {
    const dishName = (r.dish_name || "").trim();
    const ingredientName = (r.ingredient || "").trim().toLowerCase();
    if (!dishName || !ingredientName) return; // skip blank/incomplete rows

    if (!dishMap.has(dishName)) {
      dishMap.set(dishName, { name: dishName, ingredients: [], tags: new Set() });
    }
    const dish = dishMap.get(dishName);

    const rawQty = (r.quantity ?? "").toString().trim();
    const quantity = rawQty === "" ? 1 : Number(rawQty) || rawQty;
    const unit = (r.unit || "").trim();

    dish.ingredients.push({ name: ingredientName, quantity, unit });
    parseTags(r.tags).forEach((t) => dish.tags.add(t));
  });

  return Array.from(dishMap.values()).map((d) => ({
    name: d.name,
    ingredients: d.ingredients,
    tags: Array.from(d.tags),
  }));
}

async function fetchTab(tabName) {
  const url = `${OPENSHEET_BASE}/${SHEET_ID}/${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load "${tabName}" (${res.status}). Check SHEET_ID and that the tab exists.`);
  }
  const json = await res.json();
  return groupRowsIntoDishes(json);
}

// Fetches every worksheet in parallel and returns a normalized dataset:
// { breakfast: [...], lunch: [...], dinner: [...], snack: [...], veggies: [...], mealPrep: [...] }
export async function fetchAllData() {
  const entries = Object.entries(SHEET_TABS);
  const results = await Promise.all(entries.map(([, tab]) => fetchTab(tab)));
  const data = {};
  entries.forEach(([key], i) => {
    data[key] = results[i];
  });
  return data;
}
