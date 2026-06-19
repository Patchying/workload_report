# MDS Task Time Tracker

A web dashboard that reads team time-allocation data from Google Sheets and visualizes it as an interactive stacked bar chart. Deployed on Vercel with a serverless backend to keep Google credentials secure.

---

## Project Goal

Display how each team allocates their working hours across 7 task categories, compare against benchmarks, and allow filtering by month. The app has two tabs: **Data Analysis** (the main chart) and **Performance Tracking** (placeholder for now).

---

## Tech Stack

- **Frontend:** Single-page `index.html` — vanilla JS + Chart.js 4.5.0 (CDN)
- **Backend:** Vercel Serverless Function (`/api/data.js`) — Node.js, calls Google Sheets API
- **Auth:** Google Service Account (credentials stored as Vercel environment variable)
- **Deployment:** Vercel (connect GitHub repo → auto-deploy on push)

---

## Project Structure

```
/
├── api/
│   └── data.js          ← Vercel serverless function
├── public/
│   └── index.html       ← Single-page frontend
├── package.json
├── vercel.json
└── CLAUDE.md
```

---

## Environment Variables

Set these in Vercel dashboard → Project Settings → Environment Variables:

```
GOOGLE_SERVICE_ACCOUNT_KEY=<full service account JSON as a single-line string>
SPREADSHEET_ID=1zwq27G6mvPUdOZ0RZbIKtQIxNukQ8xlO-DGOAKjdM_Q
```

---

## Backend: `/api/data.js`

### What it does
- Authenticates with Google Sheets API using the service account
- Reads the `Accum` sheet from the spreadsheet
- Detects the correct header row **dynamically** (never hardcoded)
- Returns cleaned row data as JSON to the frontend

### Header Detection (critical)
The `Accum` sheet has multiple stacked tables. Scan rows until finding a cell whose trimmed value equals exactly `"team(Reconciled)"`. That row is the header. Build a `colMap` object mapping every header name to its column index. All subsequent column lookups must use `colMap["headerName"]` — never hardcoded indices.

### Row Object Shape (returned array)
```json
{
  "t": "Merchant Data",
  "g": "Group A",
  "l": "L2",
  "m": 4,
  "y": 2026,
  "Communication & Meetings": 15.2,
  "Documentation & Content": 8.4,
  "Data Operations": 22.1,
  "System & Portal Management": 10.0,
  "Issue Handling": 5.3,
  "Strategic Initiatives": 39.0,
  "subs": {
    "1.1 Internal team meeting": 5.1,
    "1.3 Cross-functional meeting": 4.2,
    "1.5 Client meeting": 6.0
  }
}
```

### Row Processing Rules
- Skip rows where `team` is blank, equals `"team(Reconciled)"`, or `"team"`, or month is outside 1–12
- **Year:** read from a `Year` column; if missing or < 2000, parse from the `Submission Date` column (col A); last resort: current year
- **Bucket values:** use the 6 pre-aggregated bucket columns if their sum > 0; otherwise fall back to summing from the individual subcategory columns
- Include all matching subcategory columns in the `subs` object

### Required Columns (via colMap)
| Column name in sheet | Field |
|---|---|
| `team(Reconciled)` | `t` |
| `Group` | `g` |
| `Level` | `l` |
| `Month` | `m` |
| `Year` | `y` |
| `Communication & Meetings` | bucket |
| `Documentation & Content` | bucket |
| `Data Operations` | bucket |
| `System & Portal Management` | bucket |
| `Issue Handling` | bucket |
| `Strategic Initiatives` | bucket |

### Subcategory Columns (for `subs` and C&M split)
```
1.1_Internal_team_meeting       → "1.1 Internal team meeting"
1.2_Management_meeting          → "1.2 Management meeting"
1.3_Cross-functional_meeting    → "1.3 Cross-functional meeting"
1.4_Rollout_meeting             → "1.4 Rollout meeting"
1.5_Client_meeting              → "1.5 Client meeting"
1.6_Business_partner_meeting    → "1.6 Business partner meeting"
1.7_Training_session            → "1.7 Training session"
1.8_Contact_Customer            → "1.8 Contact Customer"
1.9_Pitching_/_Negotiating_Customer → "1.9 Pitching / Negotiating Customer"
1.10_Contact_Partner            → "1.10 Contact Partner"
1.11_Coaching_team_/_1:1_Session → "1.11 Coaching team / 1:1 Session"
2.1_Create_presentation_slides  → "2.1 Create presentation slides"
2.2_Create_report_/_dashboard   → "2.2 Create report / dashboard"
2.3_Write_/_Approve_email       → "2.3 Write / Approve email"
2.4_Document_meeting_minutes    → "2.4 Document meeting minutes"
2.5_Create_contract_/_legal_document → "2.5 Create contract / legal document"
2.6_Marketing_-_Artwork_brief   → "2.6 Marketing – Artwork brief"
2.7_Marketing_-_Artwork_creation → "2.7 Marketing – Artwork creation"
2.8_Marketing_-_Other_visualisation → "2.8 Marketing – Other visualisation"
3.1_Input_/_Record_data         → "3.1 Input / Record data"
3.2_Update_data                 → "3.2 Update data"
3.3_Transfer_data               → "3.3 Transfer data"
3.4_Analyse_/_Calculate_data    → "3.4 Analyse / Calculate data"
3.5_Reconcile_/_Cross-check_data → "3.5 Reconcile / Cross-check data"
3.6_Validate_/_QA_data          → "3.6 Validate / QA data"
3.7_Generate_data               → "3.7 Generate data"
3.8_Dispatch_data               → "3.8 Dispatch data"
4.1_Enter_/_Upload_into_system  → "4.1 Enter / Upload into system"
4.2_Configure_system            → "4.2 Configure system"
4.3_Monitor_/_Maintain_system   → "4.3 Monitor / Maintain system"
4.4_Test_system_/_feature       → "4.4 Test system / feature"
5.1_Investigate_issue           → "5.1 Investigate issue"
5.2_Resolve_issue               → "5.2 Resolve issue"
5.3_Escalate_issue              → "5.3 Escalate issue"
6.1_Design_/_Improve_process_/_workflow → "6.1 Design / Improve process / workflow"
6.2_Develop_automation_/_tool   → "6.2 Develop automation / tool"
6.3_Plan_project_/_initiative   → "6.3 Plan project / initiative"
6.4_Market_Research             → "6.4 Market Research"
6.5_Customer_Survey             → "6.5 Customer Survey"
```

---

## Frontend: `/public/index.html`

Single HTML file. Fetches `/api/data` on load, then renders the dashboard.

### Navigation Tabs
1. **Data Analysis** — main stacked bar chart
2. **Performance Tracking** — empty placeholder page

---

### Data Analysis Tab

#### Categories (CATS)
7 virtual keys rendered **bottom-to-top** in the stacked bar chart:

| # (bottom→top) | Key | Color |
|---|---|---|
| 1 | `C&M External` | `#E8B84B` |
| 2 | `C&M Internal` | `#C8960C` |
| 3 | `Issue Handling` | `#E07B54` |
| 4 | `Documentation & Content` | `#26A69A` |
| 5 | `Data Operations` | `#4A90D9` |
| 6 | `System & Portal Management` | `#7B68EE` |
| 7 | `Strategic Initiatives` | `#5CB85C` |

#### C&M Internal / External Split
These two keys are derived from the single `Communication & Meetings` bucket value plus the `subs` object:

- **C&M Internal** = sum of `subs` values for:
  - `"1.1 Internal team meeting"`
  - `"1.3 Cross-functional meeting"`
  - `"1.4 Rollout meeting"`
- **C&M External** = `Communication & Meetings` total − C&M Internal

#### Benchmark Values (%)
```javascript
const BENCHMARK = {
  'C&M Internal':                9.0,
  'C&M External':                6.0,
  'Data Operations':             9.0,
  'Documentation & Content':     9.0,
  'Issue Handling':              8.0,
  'Strategic Initiatives':      45.0,
  'System & Portal Management': 14.0
};
```

#### Teams (JOURNEY — fixed display order)
```javascript
const JOURNEY = [
  'B2B Marketing', 'Enterprise Sales', 'SMB Sales', 'After Sales Service',
  'Merchant Activation', 'Merchant Onboarding', 'Merchant Data', 'Supply Chain',
  'Business Strategy & Optimization', 'Sales Operations', 'Learning & Development',
  'Transformation', 'Customer Success', 'Enterprise Business and Operations',
  'Jera- Technical Support', 'Lifestyle Content & News',
  'Merchant Digital Solutions - WN'
];
```
Teams present in the data but not in JOURNEY appear appended at the end.

#### Chart Features

**Stacked bar chart (Chart.js 4.5.0)**
- One bar per team, ordered by JOURNEY
- Plus a `"— Total —"` aggregate bar (average across all teams)
- Plus a `"⬥ Benchmark"` reference bar (uses BENCHMARK values)

**Month filter chips**
- One chip per unique year-month in the data, displayed as `"Apr 2026"` format
- Multi-select: clicking toggles a month in/out of the filter
- When no chip is selected, all months are included
- Selecting specific chips filters rows to only those months before aggregating

**Chart mode toggle (two buttons: Fixed | Ranked)**
- **Fixed mode:** all teams share the same category stack order (bottom = C&M External, top = Strategic Initiatives) — same as the CATS array order
- **Ranked mode:** each team's bar is sorted independently — smallest value at bottom, largest at top — so relative size determines vertical position, not category identity

**Drill-down modal**
- Clicking any bar segment opens a modal
- Shows subcategory breakdown for that specific team + category combination, for the currently selected months
- Both `C&M Internal` and `C&M External` open the full `Communication & Meetings` subcategory list (all 11 subcats), not just one half

---

## Styling / Design System

```css
--gold:    #C8960C;
--gold-lt: #E8B84B;
--bg:      #FAFAF8;
--surface: #FFFFFF;
--border:  #E5E0D5;
--text:    #2C2A26;
--muted:   #8A8070;
```

- Font: system sans-serif stack
- Subtle card shadows, gold accent on active/selected states
- Month filter chips: pill-shaped, gold border when selected
- Chart mode toggle: two buttons, active button filled gold

---

## vercel.json

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/public/index.html" }
  ]
}
```

---

## package.json

```json
{
  "name": "mds-task-tracker",
  "version": "1.0.0",
  "dependencies": {
    "googleapis": "^140.0.0"
  }
}
```

---

## Implementation Notes

1. **Never hardcode row/column numbers** when reading the sheet — always use `colMap`
2. **Keep credentials server-side only** — the frontend never touches the service account key; it only calls `/api/data`
3. **C&M split is computed client-side** from the `subs` object returned by the API — the API does not need to split it
4. **Ranked mode** must sort each team's dataset order independently — do not globally reorder the Chart.js datasets; instead build per-team sorted data and use Chart.js's dataset index mapping
5. **The benchmark bar** uses fixed BENCHMARK values and is never affected by month filters
