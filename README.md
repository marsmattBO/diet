# Mealprep Ledger

A fully static weekly meal planner + grocery list generator. No backend: dish
data lives in a Google Sheet, fetched client-side as JSON via
[opensheet](https://github.com/benborgers/opensheet), and all filtering /
scoring / plan generation runs in the browser. Deploys as a static site to
GitHub Pages.

## 1. Set up the Google Sheet

Create one Google Sheet with **6 tabs** (worksheets), named exactly:

| Tab name    | Represents                                  |
|-------------|----------------------------------------------|
| `Breakfast` | Breakfast dishes                              |
| `Lunch`     | Lunch **mains** (paired with a Veggies row)   |
| `Dinner`    | Dinner **mains** (paired with a Veggies row)  |
| `Snacks`    | Snacks                                        |
| `Veggies`   | Veggie sides — paired independently with Lunch and Dinner mains |
| `MealPrep`  | Batch-cook lunch mains, used on your "work lunch" days |

Each tab needs exactly these **3 columns**, header row included:

| name | ingredients | tags |
|------|-------------|------|

- **name** — dish name, plain text.
- **ingredients** — `ingredient:quantity:unit` entries separated by `;`.
  Example:
  ```
  chicken breast:200:g; broccoli:150:g; soy sauce:1:tbsp
  ```
  Quantity and unit are both optional (`rice` alone defaults to qty `1`, unit `""`).
- **tags** — comma-separated: `vegetarian, gluten-free`, etc. Leave blank for
  no restrictions.

Example `Dinner` row:

| name | ingredients | tags |
|---|---|---|
| Baked Salmon & Broccoli | salmon:200:g; olive oil:1:tbsp; lemon:0.5:pcs | gluten-free, high-protein |

Example `Veggies` row:

| name | ingredients | tags |
|---|---|---|
| Steamed Broccoli | broccoli:150:g; olive oil:1:tsp | vegan, gluten-free |

## 2. Share the sheet

File → Share → **"Anyone with the link" → Viewer**. That's it — no API key,
no service account, no OAuth. opensheet reads public sheets directly.

Grab the Sheet ID from the URL:

```
https://docs.google.com/spreadsheets/d/THIS_LONG_ID_HERE/edit
```

## 3. Configure the app

Open `src/config.js` and paste your Sheet ID:

```js
export const SHEET_ID = "THIS_LONG_ID_HERE";
```

Tab names in `SHEET_TABS` must match your sheet's tab names exactly
(case-sensitive).

## 4. Run locally

```bash
npm install
npm run dev
```

## 5. Deploy to GitHub Pages

Two options:

**A) GitHub Actions (recommended, already set up)**
1. Push this repo to GitHub.
2. In `vite.config.js`, set `base` to `/<your-repo-name>/`.
3. Repo Settings → Pages → Source → **GitHub Actions**.
4. Push to `main` — `.github/workflows/deploy.yml` builds and deploys automatically.

**B) Manual, via `gh-pages`**
```bash
npm run deploy
```
This builds and pushes `dist/` to a `gh-pages` branch. Set Pages source to
that branch in repo settings.

## How the plan is generated

- **Breakfast** and **Snack**: one dish picked per day from their sheet.
- **Lunch** and **Dinner**: a **Main** + a **Veggie side**, scored and picked
  independently, then paired for the meal. This mirrors how you actually eat
  — main dish + veggies — rather than baking the side into one recipe.
- The first `workMealsPerWeek` weekdays pull their lunch **Main** from
  `MealPrep` instead of `Lunch`, so early-week batch cooking gets used up.
- Every candidate dish is scored:
  ```
  score = ingredient_overlap * 3
        + novelty * 1
        + meal_prep_bonus * 1.5
        + variety_penalty * 2
  ```
  favoring ingredients already in the week's pool (fewer unique groceries),
  discouraging repeats, and rewarding meal-prep dishes. A small ±10% random
  factor keeps it from being fully deterministic.
- Dietary preferences filter candidates by tag; if nothing matches, the
  filter relaxes one preference at a time rather than failing.
- The grocery list aggregates ingredient quantities across the week,
  summing same-name/same-unit ingredients (e.g. `broccoli: 450g` if it
  appears in three dishes at 150g each).

## Project structure

```
src/
  api/sheets.js     fetch + parse the Google Sheet via opensheet
  logic/planner.js  scoring, selection, grocery aggregation (pure functions)
  config.js         sheet ID, tab names, default personalization
  App.jsx           UI
  styles.css
```

No state management library, no CSS framework, no backend — plain React +
`fetch`. Update dishes by editing the sheet; update logic by editing
`src/logic/planner.js`.
