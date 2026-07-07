# UNIC Academic — Practice Portal

Pure HTML + vanilla JavaScript + AJAX frontend, deployed on **Vercel** with
**Node.js serverless functions** as the backend, storing data in **Postgres
via Hasura GraphQL**.

## ✨ Features

- **4 Subjects** — Physics (PH), Chemistry (CH), Mathematics (MA), Biology (BIO)
- **Concept section** — collapsible theory/notes block shown above practice questions for every chapter
- **3 Question types** — MCQ (single-select), MSQ (multi-select), NAT (Numerical Answer Type with tolerance)
- **Type filter tabs** — switch between All / MCQ / MSQ / NAT within a chapter
- **LaTeX support** — KaTeX rendering for math in concepts, questions, options, explanations
- **Sidebar** — collapsible unit → chapter tree with live progress bars
- **Prev / Next navigation** — flows across chapters automatically
- **Optional registration modal** — skip-able, saved via AJAX to Hasura
- **Admin panel** (`admin.html`) — key-protected dashboard with search, pagination, CSV export
- **Admin Question Builder** — create/edit Subjects → Units → Chapters → Concept + Questions (MCQ/MSQ/NAT) entirely from the browser, in the exact JSON schema the app uses, with live JSON preview, JSON download, and one-click save to the database
- **Serverless backend** — Vercel functions (`api/*.js`) talking to Hasura GraphQL

## 📁 Project Structure

```
unic/
├── index.html              # Main app (HTML/CSS/JS in one file)
├── admin.html               # Admin dashboard
├── package.json              # Node config for Vercel
├── vercel.json                 # Vercel function settings
├── .env.example                # Env vars template
├── data/
│   ├── config.json              # Academy name, subjects, "how did you find us" options
│   ├── physics.json              # PH: units → chapters → concept + questions
│   ├── chemistry.json
│   ├── mathematics.json
│   └── biology.json
├── lib/
│   └── hasura.js                  # Shared GraphQL client used by all functions
├── api/
│   ├── register.js                  # POST → inserts a registration into Hasura
│   ├── attempt.js                    # POST → inserts a question attempt into Hasura
│   ├── admin.js                       # GET  → fetches data for the admin panel
│   └── content.js                      # GET (public) / POST (admin) → subject content used by the Question Builder
└── hasura/
    └── migrations/
        └── 001_init.sql               # SQL to create registrations / attempts / subject_content tables
```

## 🗄️ Step 1 — Set up Hasura

You need a running Hasura instance connected to a Postgres database. The
fastest way is **Hasura Cloud** (free tier) or **Nhost** (Hasura + Postgres
bundled, also free tier).

1. Create a project at cloud.hasura.io (or Nhost)
2. Connect/create a Postgres database
3. Open the Hasura Console → Data → SQL, paste the contents of
   `hasura/migrations/001_init.sql`, and run it
4. Go to Data → for both `registrations` and `attempts` tables, click
   Track
5. Go to Settings → Env Vars and copy:
   - Your GraphQL endpoint URL (e.g. `https://your-app.hasura.app/v1/graphql`)
   - Your admin secret

No public Hasura permissions are needed — the serverless functions talk to
Hasura using the admin secret server-side only, never exposed to the browser.

## 🚀 Step 2 — Deploy to Vercel

```bash
cd unic
npx vercel
```

Or connect the repo via the Vercel dashboard (Import Project → select repo).

### Set environment variables on Vercel

Go to Project → Settings → Environment Variables and add:

| Key | Value |
|---|---|
| `HASURA_GRAPHQL_URL` | `https://your-app.hasura.app/v1/graphql` |
| `HASURA_ADMIN_SECRET` | your Hasura admin secret |
| `ADMIN_KEY` | a password of your choice for `admin.html` |

Redeploy after adding env vars so the functions pick them up.

## 🧪 Local development

```bash
cp .env.example .env
# fill in .env with your Hasura values
npx vercel dev
```

This runs the static frontend + serverless functions together at
`http://localhost:3000`, just like production.

## 📝 Adding / Editing Content

### Concept (theory) section

Each chapter in the JSON files can include a `concept` block, rendered at
the top of the chapter before questions:

```json
"concept": {
  "title": "Newton's Laws of Motion",
  "latex": true,
  "body": [
    "Plain text or **bold** text. Use $inline$ or $$display$$ LaTeX.",
    "Each string in this array becomes its own paragraph."
  ],
  "formulas": [
    "$F = ma$",
    "$a = g\\sin\\theta$"
  ]
}
```

### Questions — MCQ / MSQ / NAT

```json
{
  "id": "unique_id",
  "type": "MCQ",
  "latex": true,
  "question": "If $x^2 = 4$, then $x = $",
  "options": ["$2$", "$-2$", "$\\pm 2$", "$4$"],
  "answer": [2],
  "explanation": "Both +2 and -2 satisfy x²=4."
}
```

For NAT questions, use a numeric `answer` plus optional `tolerance` and `unit`:

```json
{
  "id": "ph_q3n",
  "type": "NAT",
  "latex": true,
  "question": "A block of mass $4\\,\\text{kg}$ is pulled by a force of $20\\,\\text{N}$. Find acceleration in m/s².",
  "answer": 5,
  "tolerance": 0.1,
  "unit": "m/s²",
  "explanation": "a = F/m = 20/4 = 5 m/s²."
}
```

The grader accepts any value within `answer ± tolerance`.

## ✏️ Admin Question Builder

Visit `/admin.html`, log in, and click the **Question Builder** tab. From here you can:

1. **Pick or create a subject** — the 4 built-in subjects (PH/CH/MA/BIO) load automatically; click **+ New Subject** to add more (e.g. Computer Science, English)
2. **Add Units and Chapters** using the tree on the left
3. **Edit the Concept** (theory) for a chapter — title, LaTeX toggle, body paragraphs, key formulas
4. **Add Questions** — MCQ, MSQ, or NAT — with options, correct-answer selection, explanation, and (for NAT) tolerance/unit
5. **Preview JSON** — see the exact document that will be saved, matching the schema below
6. **Save to Database** — upserts the subject into the `subject_content` Hasura table; the main app automatically prefers this live data over the static `/data/*.json` files
7. **Download JSON** — also export the subject as a standalone `.json` file if you want to commit it directly into `/data/`

Everything created in the builder follows the exact same JSON schema used by
the static data files — see "Adding / Editing Content" below for the full
`concept` and question (`MCQ`/`MSQ`/`NAT`) field reference.

## 🔐 Admin Panel

Visit `/admin.html` and enter your `ADMIN_KEY`. The dashboard shows
registrations and attempts pulled live from Hasura, with search, pagination,
and CSV export.

## 🛠️ Tech notes

- Frontend: pure vanilla JavaScript, no build tools or frameworks; AJAX via `XMLHttpRequest`
- Backend: Vercel Node.js serverless functions (`api/*.js`), using native `fetch` (Node 18+) to call Hasura — no extra HTTP library needed
- Data: Postgres, accessed exclusively through Hasura's auto-generated GraphQL API
- KaTeX loaded from CDN with `auto-render` for `$...$` / `$$...$$` delimiters
- All styling is plain CSS with CSS variables — no Tailwind/Bootstrap dependency
