import React, { useState, useEffect, useCallback, useMemo } from "react";
import { fetchAllData } from "./api/sheets.js";
import { generatePlan, reusedIngredientNames } from "./logic/planner.js";
import { DEFAULT_CONFIG, ALL_TAGS, SHEET_ID } from "./config.js";

const DAY_COUNT = 7;

function formatQty(g) {
  if (!g) return "";
  if (g.numeric === false) return g.occurrences > 1 ? `×${g.occurrences}` : "";
  const q = typeof g.quantity === "number" ? Math.round(g.quantity * 100) / 100 : g.quantity;
  return g.unit ? `${q} ${g.unit}` : `${q}`;
}

export default function App() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("plan");

  const loadData = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const d = await fetchAllData();
      setData(d);
      setResult(generatePlan(d, config));
      setStatus("ready");
    } catch (err) {
      setError(err.message || String(err));
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = () => {
    if (!data) return;
    setResult(generatePlan(data, config));
  };

  const toggleTag = (tag) => {
    setConfig((c) => ({
      ...c,
      dietaryPreferences: c.dietaryPreferences.includes(tag)
        ? c.dietaryPreferences.filter((t) => t !== tag)
        : [...c.dietaryPreferences, tag],
    }));
  };

  const reused = useMemo(() => (result ? reusedIngredientNames(result.groceries) : new Set()), [result]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand-row">
            <div className="brand-mark">MP</div>
            <div>
              <div className="brand-title">Mealprep Ledger</div>
              <div className="brand-sub">weekly plan &amp; grocery reconciliation</div>
            </div>
          </div>
          <button className="btn-primary" onClick={handleGenerate} disabled={status !== "ready"}>
            ↻ Generate week
          </button>
        </div>
      </header>

      {status === "loading" && (
        <div className="state-box">
          <h2>Loading dishes…</h2>
          <p>Fetching Breakfast, Lunch, Dinner, Snacks, Veggies and MealPrep from your Google Sheet.</p>
        </div>
      )}

      {status === "error" && (
        <div className="state-box">
          <h2>Couldn't load your sheet</h2>
          <p>{error}</p>
          <code>{`Sheet ID in src/config.js: "${SHEET_ID}"`}</code>
          <p style={{ marginTop: 14 }}>
            Make sure the sheet is shared as "Anyone with the link — Viewer" and that tab names match
            exactly: Breakfast, Lunch, Dinner, Snacks, Veggies, MealPrep.
          </p>
          <button className="btn-primary" style={{ margin: "10px auto 0" }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {status === "ready" && result && (
        <div className="body">
          <aside className="sidebar">
            <div className="panel-label">⚙ Personalization</div>

            <div className="field">
              <label className="field-label">Work lunches per week</label>
              <div className="stepper-row">
                <button className="step-btn" onClick={() => setConfig((c) => ({ ...c, workMealsPerWeek: Math.max(0, c.workMealsPerWeek - 1) }))}>–</button>
                <div className="stepper-value">{config.workMealsPerWeek}</div>
                <button className="step-btn" onClick={() => setConfig((c) => ({ ...c, workMealsPerWeek: Math.min(DAY_COUNT, c.workMealsPerWeek + 1) }))}>+</button>
              </div>
              <div className="field-hint">
                First {config.workMealsPerWeek} weekday{config.workMealsPerWeek === 1 ? "" : "s"} pull their lunch main from the MealPrep sheet.
              </div>
            </div>

            <div className="field">
              <label className="field-label">Dietary preferences</label>
              <div className="tag-grid">
                {ALL_TAGS.map((tag) => (
                  <button
                    key={tag}
                    className={`tag-chip ${config.dietaryPreferences.includes(tag) ? "active" : ""}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {config.dietaryPreferences.includes(tag) ? "✓ " : ""}{tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" />

            <div className="panel-label">📄 Data source</div>
            <div className="source-note">
              Dishes come live from your Google Sheet — edit rows there, then hit <strong>Generate week</strong>
              (or reload the page) to pull fresh data. Ingredient cells use{" "}
              <code>name:qty:unit</code> separated by <code>;</code>.
            </div>
          </aside>

          <main className="main">
            <div className="tab-row">
              <button className={`main-tab ${tab === "plan" ? "active" : ""}`} onClick={() => setTab("plan")}>Weekly plan</button>
              <button className={`main-tab ${tab === "grocery" ? "active" : ""}`} onClick={() => setTab("grocery")}>
                🛒 Grocery list ({result.groceries.length})
              </button>
            </div>

            {tab === "plan" && (
              <div className="plan-grid">
                {result.weeklyPlan.map((day, i) => (
                  <div className="day-card" key={day.day}>
                    <div className="day-header">
                      <span className="day-index">{String(i + 1).padStart(2, "0")}</span>
                      <span className="day-name">{day.day}</span>
                    </div>

                    <SimpleMealRow label="Breakfast" dish={day.breakfast} reused={reused} />
                    <ComposedMealRow label="Lunch" pair={day.lunch} reused={reused} />
                    <ComposedMealRow label="Dinner" pair={day.dinner} reused={reused} />
                    <SimpleMealRow label="Snack" dish={day.snack} reused={reused} />
                  </div>
                ))}
              </div>
            )}

            {tab === "grocery" && (
              <div className="receipt-wrap">
                <div className="receipt">
                  <div className="receipt-header">
                    <div className="receipt-title">WEEKLY GROCERY LIST</div>
                    <div className="receipt-sub">{result.groceries.length} unique items · {DAY_COUNT}-day plan</div>
                  </div>
                  <div className="receipt-dashed" />
                  {result.groceries.map((g) => (
                    <div className={`receipt-row ${g.occurrences > 1 ? "reused" : ""}`} key={`${g.name}|${g.unit}`}>
                      <span>{g.name}</span>
                      <span className="receipt-qty">{formatQty(g)}</span>
                    </div>
                  ))}
                  <div className="receipt-dashed" />
                  <div className="receipt-footer">
                    {result.groceries.filter((g) => g.occurrences > 1).length} ingredients reused across meals
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function SimpleMealRow({ label, dish, reused }) {
  return (
    <div className="meal-row">
      <div className="meal-label">{label}</div>
      <div className="meal-name">{dish ? dish.name : "No dish available"}</div>
      {dish && (
        <div className="meal-ingr">
          {dish.ingredients.map((ing) => (
            <span key={ing.name} className={`ingr-tag ${reused.has(ing.name) ? "reused" : ""}`}>
              {ing.name} {ing.quantity}{ing.unit}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ComposedMealRow({ label, pair, reused }) {
  return (
    <div className="meal-row">
      <div className="meal-label">{label}</div>
      <div className="meal-pair">
        <div>
          <span className="meal-slot-tag">Main · </span>
          <span className="meal-name">{pair.main ? pair.main.name : "No dish available"}</span>
          {pair.main && (
            <div className="meal-ingr">
              {pair.main.ingredients.map((ing) => (
                <span key={ing.name} className={`ingr-tag ${reused.has(ing.name) ? "reused" : ""}`}>
                  {ing.name} {ing.quantity}{ing.unit}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="meal-slot-tag">Veggies · </span>
          <span className="meal-name">{pair.veggie ? pair.veggie.name : "No dish available"}</span>
          {pair.veggie && (
            <div className="meal-ingr">
              {pair.veggie.ingredients.map((ing) => (
                <span key={ing.name} className={`ingr-tag ${reused.has(ing.name) ? "reused" : ""}`}>
                  {ing.name} {ing.quantity}{ing.unit}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
