# GoGreenNext dashboard

An interactive explorer for `NBS_Scaling_Quanti_v8.mdl`: one model, five cities — the
four pilots (Cork, Klagenfurt, Lahti, Malta) and a hypothetical reference city —
calendar years 2012–2075. SDEverywhere
compiles the Vensim model to JavaScript that runs in the browser, so charts update as
you move a slider.

Levers take effect from the **policy start year** (2027 by default, adjustable in the
sidebar). Everything before it is the city's own history and does not move when you
change a lever; every chart marks the year.

The published dashboard is at <https://msjalali.github.io/GoGreenNext/>. Every push to `main` rebuilds it:
`.github/workflows/pages.yaml` compiles the model, checks it against the Python
reference, and deploys only if that check passes.

## Run it

```bash
cd dashboard
npm install
npm run dev
```

Then open <http://localhost:5178>. Node 18+.

| Command | What it does |
|---|---|
| `npm run dev` | Live dashboard on port 5178 |
| `npm run model` | Recompile `model.mdl` into `build/model.js`. **Run after any model change.** |
| `npm run verify` | Check the compiled model against the Python reference (20 city/scenario combinations) |
| `npm run build` | Static bundle into `dist/` (~132 kB JS, 32 kB gzipped) |
| `npm run preview` | Serve the built `dist/` on port 5179, to check it before sharing |

## Sharing it without a server

`npm run build` writes a self-contained `dist/`: **double-click `dist/index.html`** and
the dashboard runs, no Node and no server. Two files, about 135 kB, so it can go in an
email or a shared folder.

That works because the build differs from the dev server in three ways, all set in
`vite.config.js`: asset paths are relative (`base: './'`), the bundle is one classic
script rather than an ES module (browsers refuse module scripts over `file://`), and
the CSS and the model spec are inlined into it. `src/model.js` therefore loads the
compiled model in `initModel()` rather than with a top-level `await`, which cannot be
bundled into a classic script; `src/main.js` awaits it once before the first render.

## After changing the model

`model.mdl` is a copy of `NBS_Scaling_Quanti_v8.mdl` — never edit it directly. When the
model changes, copy it in again, regenerate `model.spec.json` and `src/profiles.js`,
then recompile and check:

```bash
npm run model && npm run verify
```

`build/` and `dist/` are generated and not kept in the repository.

## How it is put together

| File | Role |
|---|---|
| `src/profiles.js` | **Generated** from the model: each city's profile values, the CITY DATA / PROVISIONAL label and the source sentence, all read from the model's own comments. Never edit by hand. |
| `model.spec.json` | **Generated** too: 26 inputs, 215 outputs. The app reads the input order from this file, so the two cannot drift apart. |
| `src/model.js` | Loads the compiled model and runs it. Each run is copied out immediately, because the runner reuses one output buffer. |
| `src/indicators.js` | What each tab shows: chart definitions by domain, headline metrics, compare-mode indicators, scenario presets. |
| `src/chart.js` | Canvas charts: time series with history shading, 2030/2050 markers, the policy-start marker, target lines and a pinned comparison, plus bars and a scatter. No chart library. |
| `src/main.js` | State, sidebar, views. |
| `src/style.css` | Design tokens and components, light and dark. |

## What the dashboard shows

- **One city:** six headline numbers at 2026, 2050 or 2075, each showing what the
  current settings buy against this city doing nothing new; then tabs for the five
  proposal domains (climate and ecosystem, health, justice, integration, transformative
  potential), the delivery engine, and trade-offs.
- **Compare cities:** the same policy in all five, on one chart and one scale, per
  100,000 residents where that makes them comparable. The legend is also the city
  picker. The hypothetical city is grey, so it does not read as a fifth pilot.
- **Guided tour:** seven steps through the five domains, ending on the equity backfire
  and on what delay costs. This is the proposal's learning sequence.
- **Data:** the selected city's indicators as CSV, one row per whole year.
- **Why it behaves like this:** the four feedback loops in plain words, on the Delivery
  engine tab. The causal diagram itself is the Vensim CLD, not part of the app.
- **Trade-offs:** every scenario as a point — public green against mental health — plus
  bars showing what the current settings buy and what they cost.
- **Provenance:** every profile value carries a badge. Hover it for the source sentence
  from the model. The banner says how many of the city's values are still provisional.

Colours mean the same thing everywhere: orange = deprived areas, blue = rest of city,
teal = citywide. Compare mode is the exception: there the entity being compared is the
city itself, so each pilot gets its own colour.

Dragging a slider only updates the value label and schedules one redraw per animation
frame; the nine scenario runs behind the Trade-offs tab are memoised, because they
depend on the city and the policy year but not on the levers.

On a phone the sidebar becomes a drawer behind the **Controls** button, so the page
opens on the results, and a chip row repeats the city, scenario and policy year.

The model's subscript element is `Generic`; the dashboard labels it **Hypothetical
city** and sorts it last. Renaming it in the model would ripple through every recorded
reference and the regression chain.

## Honest limits

- The model is **not calibrated to history**. The run starts from each city's profile at
  2012, not from what actually happened. The shaded stretch to 2026 is where observed
  data will go once WP3 supplies it. The levers no longer disturb that stretch, but the
  city profile sliders and the evidence coefficients still apply to the whole run: they
  are what the city is and what the world is, not decisions taken on a date.
- Four of each pilot's eleven profile values are still **provisional** (land, green
  cover, existing public green, budget), so on those indicators the cities barely
  differ. The badges say which.
- Capability and support are stylised indices. They explain the dynamics; they are not
  measurements, and they are not offered for comparison between cities.
