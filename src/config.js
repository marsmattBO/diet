// ---------------------------------------------------------------------------
// Google Sheet configuration
// ---------------------------------------------------------------------------
// 1. Create a Google Sheet with one tab per category (see SHEET_TABS below).
//    Column headers, exactly (case-sensitive): name | ingredients | tags
// 2. File > Share > "Anyone with the link" (Viewer) — opensheet just needs
//    the sheet to be readable, it does NOT need to be "Published to web".
// 3. Copy the Sheet ID from the URL:
//    https://docs.google.com/spreadsheets/d/<THIS_PART>/edit
// 4. Paste it below.
//
// Data source: https://opensheet.elk.sh/<sheetId>/<tabName>
// It turns each sheet tab into a JSON array of row objects for free, no
// auth, no backend. Rate limits are generous but it caches for a few
// minutes on their end, so edits may take a moment to show up.
// ---------------------------------------------------------------------------

export const SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";

export const OPENSHEET_BASE = "https://opensheet.elk.sh";

// One tab per entity, as you described: Breakfast, Lunch, Dinner, Snacks,
// Veggies, and MealPrep are all independent worksheets/entities.
// Lunch & Dinner tabs hold "mains" — they get paired with a Veggies row
// at plan-generation time, rather than baking a side into the dish itself.
export const SHEET_TABS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
  veggies: "Veggies",
  mealPrep: "MealPrep",
};

// Default personalization, editable in the UI.
export const DEFAULT_CONFIG = {
  workMealsPerWeek: 3,
  dietaryPreferences: [],
};

export const ALL_TAGS = ["vegetarian", "vegan", "gluten-free", "high-protein"];
