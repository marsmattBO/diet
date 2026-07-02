import { SHEET_ID, OPENSHEET_BASE, SHEET_TABS } from "../config.js";

// ---------------------------------------------------------------------------
// Ingredient cell format (single column, semicolon-separated entries):
//
//   chicken breast:200:g; broccoli:150:g; soy sauce:1:tbsp
//
// Each entry is  name:quantity:unit  — unit is free text (g, ml, tbsp, pcs...).
// Quantity is optional (defaults to 1) and unit is optional (defaults to "").
// Whitespace around each field is trimmed automatically.
//
// Tags cell format (single column, comma-separated):
//
//   vegetarian, gluten-free
// ---------------------------------------------------------------------------

export function parseIngredients(cell) {
  if (!cell || typeof cell !== "string") return [];
  return cell
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [name, qty, unit] = chunk.split(":").map((p) => (p ?? "").trim());
      return {
        name: (name || "").toLowerCase(),
        quantity: qty ? Number(qty) || qty : 1,
        unit: unit || "",
      };
    });
}

function parseTags(cell) {
  if (!cell || typeof cell !== "string") return [];
  return cell
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function parseRows(rows) {
  return rows
    .filter((r) => r.name && r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      ingredients: parseIngredients(r.ingredients),
      tags: parseTags(r.tags),
    }));
}

async function fetchTab(tabName) {
  const url = `${OPENSHEET_BASE}/${SHEET_ID}/${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load "${tabName}" (${res.status}). Check SHEET_ID and that the tab exists.`);
  }
  const json = await res.json();
  return parseRows(json);
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
