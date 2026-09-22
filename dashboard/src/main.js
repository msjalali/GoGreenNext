// GoGreenNext dashboard. State -> model runs -> charts. No framework.
import { CITIES, INPUTS, START_YEAR, END_YEAR, TODAY } from './profiles.js'
import { run, years, initModel } from './model.js'
import { DOMAINS, HEADLINES, COMPARE, SCENARIOS, FMT, TICK, TOUR, LOOPS } from './indicators.js'
import { lineChart, barChart, scatter, attachHover, cursor } from './chart.js'

const DEFAULTS = Object.fromEntries(INPUTS.map(i => [i.name, i.default]))
const MILESTONES = [2030, 2050]
const POLICY_YEAR = 'Policy Start Year'
const READOUT_YEARS = [TODAY, 2050, END_YEAR]

const state = {
  city: 'Cork',
  mode: 'city',
  domain: 'health',
  scenario: 'Balanced',
  values: { ...DEFAULTS },
  pinned: null,            // { label, values }
  readoutYear: END_YEAR,
  compareId: 'mental',
  tour: null,               // index into TOUR while the guided tour is running
  theme: recall('ggn-theme') || 'light'
}

// the file:// build has an opaque origin, where localStorage can throw rather than
// return null; a remembered theme is never worth losing the page over
function recall(key) { try { return localStorage.getItem(key) } catch { return null } }
function remember(key, v) { try { localStorage.setItem(key, v) } catch { /* ignore */ } }
const cityOf = id => CITIES.find(c => c.id === id)
const popOf = id => cityOf(id).population
const depPopOf = id => cityOf(id).rows.find(r => r.var === 'Population').values[0]

// ---------------------------------------------------------------- runs
let current, pinnedRun
function compute() {
  current = run(state.values, DEFAULTS)
  pinnedRun = state.pinned ? run(state.pinned.values, DEFAULTS) : null
}
const atYear = (values, year) => values[Math.round((year - START_YEAR) / (years[1] - years[0]))]

// ---------------------------------------------------------------- sidebar
function buildSidebar() {
  const sel0 = document.getElementById('city-select')
  if (!sel0.options.length) {
    // the pilots and the reference city are different kinds of thing; say so
    const groups = { 'Pilot cities': CITIES.filter(c => c.id !== 'Generic'),
                     'Reference': CITIES.filter(c => c.id === 'Generic') }
    for (const [label, cities] of Object.entries(groups)) {
      if (!cities.length) continue
      const g = document.createElement('optgroup')
      g.label = label
      for (const c of cities) {
        g.appendChild(new Option(`${c.name}; population: ${(c.population / 1000).toFixed(0)}K`, c.id))
      }
      sel0.appendChild(g)
    }
    sel0.onchange = () => { state.city = sel0.value; render() }
  }
  sel0.value = state.city
  document.getElementById('city-blurb').textContent = cityOf(state.city).blurb

  const sel = document.getElementById('scenario')
  if (!sel.options.length) {
    for (const name of [...Object.keys(SCENARIOS), 'Custom']) sel.add(new Option(name, name))
    sel.onchange = () => {
      state.scenario = sel.value
      if (sel.value !== 'Custom') {
        // DEFAULTS already carries each city's own budget and cost; the policy start
        // year is a timing choice rather than a lever, so a preset does not reset it
        state.values = { ...DEFAULTS, ...SCENARIOS[sel.value],
                         [POLICY_YEAR]: state.values[POLICY_YEAR] }
      }
      render()
    }
  }
  sel.value = state.scenario

  slidersInto('timing', INPUTS.filter(i => i.group === 'timing'))
  slidersInto('levers', INPUTS.filter(i => i.group === 'lever'))
  slidersInto('posture', INPUTS.filter(i => i.group === 'posture'))
  slidersInto('profile-edit', INPUTS.filter(i =>
    i.group === 'profile' && (!i.city || i.city === state.city)))
  profileTable()
}

const showValue = (meta, v) =>
  meta.base === 'Municipal NBS Budget' ? `€${(v / 1000).toFixed(1)}m`
    : meta.base === 'Delivery Cost per Hectare' ? `€${Math.round(v)}k`
    : meta.base === 'Policy Start Year' ? String(Math.round(v))
    : meta.base === 'Budget Change from Policy Start' ? `×${v.toFixed(2)}`
    : meta.max <= 1.01 ? `${Math.round(v * 100)}%` : v.toFixed(2)

function slidersInto(elId, inputs) {
  const host = document.getElementById(elId)
  host.innerHTML = ''
  for (const meta of inputs) {
    const wrap = document.createElement('div')
    wrap.className = 'slider'
    const v = state.values[meta.name]
    const id = `s-${elId}-${meta.name}`.replace(/[^\w-]/g, '')
    const step = meta.base === 'Policy Start Year' ? 1 : (meta.max - meta.min) / 100
    wrap.innerHTML = `
      <div class="head">
        <label class="name" for="${id}">${meta.label}</label>
        ${meta.help ? `<button class="helpbtn" type="button" aria-expanded="false"
             aria-label="What is ${meta.label}?">?</button>` : ''}
        <span class="val">${showValue(meta, v)}</span>
      </div>
      <input id="${id}" type="range" min="${meta.min}" max="${meta.max}"
             step="${step}" value="${v}" aria-label="${meta.label}">
      ${meta.help ? `<div class="pop" hidden>${meta.help}</div>` : ''}`

    const val = wrap.querySelector('.val')
    wrap.querySelector('input').oninput = e => {
      const n = Number(e.target.value)
      state.values[meta.name] = n
      val.textContent = showValue(meta, n)          // the label, without a rebuild
      state.scenario = 'Custom'
      document.getElementById('scenario').value = 'Custom'
      scheduleRender({ sidebar: false })            // one redraw per frame, at most
    }
    const btn = wrap.querySelector('.helpbtn')
    if (btn) btn.onclick = () => {
      const pop = wrap.querySelector('.pop')
      const open = pop.hidden
      closeHelp()
      pop.hidden = !open
      btn.setAttribute('aria-expanded', String(open))
    }
    host.appendChild(wrap)
  }
}

function closeHelp() {
  document.querySelectorAll('.pop').forEach(p => { p.hidden = true })
  document.querySelectorAll('.helpbtn').forEach(b => b.setAttribute('aria-expanded', 'false'))
}
document.addEventListener('click', e => { if (!e.target.closest('.slider')) closeHelp() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHelp() })

function profileTable() {
  const t = document.getElementById('profile-table')
  const c = cityOf(state.city)
  const badge = tag => tag === 'CITY DATA' ? '<span class="badge data">city data</span>'
    : tag === 'PROVISIONAL' ? '<span class="badge prov">provisional</span>'
    : '<span class="badge gen">generic</span>'
  const fmtVal = r => {
    const f = v => r.unit === '%' ? (v * 100).toFixed(r.dp) + '%'
      : r.unit === 'per 1,000/yr' ? (v * 1000).toFixed(r.dp)
      : v.toLocaleString(undefined, { maximumFractionDigits: r.dp })
    return r.values.map(f).join(' / ')
  }
  // the value already carries % or a count, so only spell out units that add something
  const unitOf = r => (r.unit && r.unit !== '%') ? `<br><span style="color:var(--muted)">${r.unit}</span>` : ''
  t.innerHTML = c.rows.map(r => `
    <tr title="${(r.note || '').replace(/"/g, '&quot;')}">
      <td>${r.label}<br>${badge(r.tag)}</td>
      <td class="v">${fmtVal(r)}${unitOf(r)}</td>
    </tr>`).join('')
}

// ---------------------------------------------------------------- charts
function card(chart, cityId) {
  const el = document.createElement('div')
  el.className = 'card'
  el.innerHTML = `<h3>${chart.title}</h3><div class="unit">${chart.unit}</div>
                  <canvas></canvas><div class="note">${chart.note || ''}</div>`
  const canvas = el.querySelector('canvas')
  const series = chart.series.map(s => ({ label: s.label, color: s.color, values: s.calc(current, cityId) }))
  const pinned = pinnedRun ? chart.series.map(s => ({ label: s.label, color: s.color, values: s.calc(pinnedRun, cityId) })) : null
  const opts = {
    years, series, pinned, fmt: chart.fmt, tickFmt: TICK.get(chart.fmt),
    target: chart.target, zero: chart.zero,
    history: { from: START_YEAR, to: TODAY }, milestones: MILESTONES,
    policy: state.values[POLICY_YEAR]
  }
  const redraw = year => { const g = lineChart(canvas, opts); cursor(canvas, g, year, years); st.geom = g }
  const st = { years, series, fmt: chart.fmt, redraw, geom: null }
  requestAnimationFrame(() => redraw(null))
  attachHover(canvas, () => st)
  return el
}

function readout() {
  const el = document.createElement('div')
  const bar = document.createElement('div')
  bar.className = 'yearbar'
  bar.innerHTML = `<span style="color:var(--muted)">Values in</span>
    <div class="seg">${READOUT_YEARS.map(y =>
      `<button data-y="${y}" aria-pressed="${y === state.readoutYear}">${y}</button>`).join('')}</div>
    ${state.pinned ? `<span style="color:var(--muted)">compared with <b>${state.pinned.label}</b></span>` : ''}`
  bar.querySelectorAll('button').forEach(b => b.onclick = () => {
    state.readoutYear = Number(b.dataset.y); render()
  })
  el.appendChild(bar)

  const grid = document.createElement('div')
  grid.className = 'readout'
  // a number on its own says little to someone deciding something: compare it with the
  // pinned reference, or, failing that, with this city doing nothing new
  const ref = pinnedRun || (settingsChanged() ? refRun('__baseline__', {}) : null)
  const refName = pinnedRun ? 'reference' : 'doing nothing new'
  for (const m of HEADLINES) {
    const v = atYear(m.calc(current, state.city), state.readoutYear)
    let delta = ''
    if (ref) {
      const p = atYear(m.calc(ref, state.city), state.readoutYear)
      const d = v - p
      const better = m.lowerIsBetter ? d < 0 : d > 0
      const cls = Math.abs(d) < Math.abs(p || 1) * 1e-4 ? 'flat' : better ? 'up' : 'down'
      delta = `<div class="d ${cls}">${d >= 0 ? '+' : '−'}${m.fmt(Math.abs(d))} vs ${refName}</div>`
    }
    const div = document.createElement('div')
    div.className = 'metric'
    div.innerHTML = `<div class="k">${m.label}</div><div class="v">${m.fmt(v)}</div>${delta}`
    grid.appendChild(div)
  }
  el.appendChild(grid)
  return el
}

/** Has the user moved anything that counts as a decision? Per-city money is part of
 *  what the city is, so it belongs to the baseline rather than being measured against it. */
const settingsChanged = () => INPUTS.some(i =>
  !i.city && i.name !== POLICY_YEAR && state.values[i.name] !== DEFAULTS[i.name])

function tradeoffCard() {
  const el = document.createElement('div')
  el.className = 'card wide'
  el.innerHTML = `<h3>What each policy buys, and what it costs</h3>
    <div class="unit">every scenario, run for ${cityOf(state.city).name}, at ${END_YEAR}</div>
    <canvas></canvas>
    <div class="note">Up and to the right is better: more public green and more poor mental health avoided.
      The highlighted point is the settings you have now.</div>`
  const points = Object.entries(SCENARIOS).map(([name, ov]) => {
    const g = refRun(name, ov)
    return {
      label: name,
      x: atYear(g(`Total Functioning NBS[${state.city}]`), END_YEAR),
      y: atYear(g.both('Poor Mental Health Cases Avoided', state.city), END_YEAR) / popOf(state.city) * 1e5
    }
  })
  points.push({
    label: 'your settings', highlight: true,
    x: atYear(current(`Total Functioning NBS[${state.city}]`), END_YEAR),
    y: atYear(current.both('Poor Mental Health Cases Avoided', state.city), END_YEAR) / popOf(state.city) * 1e5
  })
  requestAnimationFrame(() => scatter(el.querySelector('canvas'), {
    points, xLabel: `public green in ${END_YEAR} (hectares)`,
    yLabel: 'poor mental health avoided (per 100k)'
  }))
  return el
}

// keep the selected city's budget and delivery cost when switching scenarios
const cityBudget = () => Object.fromEntries(INPUTS
  .filter(i => i.city === state.city)
  .map(i => [i.name, state.values[i.name]]))

// The nine presets and the "doing nothing new" baseline start from the defaults, so
// they depend on the city, its money and when policy starts -- not on the levers.
// Memoised, because otherwise dragging a lever on the Trade-offs tab re-runs the
// model ten times a frame.
let refCache = { key: '', runs: new Map() }
function refRun(label, overrides) {
  const key = state.city + '|' + JSON.stringify(cityBudget()) + '|' + state.values[POLICY_YEAR]
  if (refCache.key !== key) refCache = { key, runs: new Map() }
  if (!refCache.runs.has(label)) {
    refCache.runs.set(label, run({ ...DEFAULTS, ...overrides, ...cityBudget(),
                                   [POLICY_YEAR]: state.values[POLICY_YEAR] }, DEFAULTS))
  }
  return refCache.runs.get(label)
}

function deltaCard() {
  const el = document.createElement('div')
  el.className = 'card wide'
  const ref = state.pinned ? state.pinned.label : 'this city doing nothing new (Balanced)'
  el.innerHTML = `<h3>Against ${ref}</h3>
    <div class="unit">difference at ${state.readoutYear}</div><canvas></canvas>
    <div class="note">Teal is better, orange is worse. Pin any settings as the reference to compare against them.</div>`
  const base = pinnedRun || refRun('__baseline__', {})
  const items = HEADLINES.map(m => {
    const v = atYear(m.calc(current, state.city), state.readoutYear)
    const b = atYear(m.calc(base, state.city), state.readoutYear)
    const d = v - b
    return { label: m.label, value: d, good: m.lowerIsBetter ? d <= 0 : d >= 0, fmt: m.fmt }
  })
  if (items.every(i => Math.abs(i.value) < 1e-9)) {
    el.querySelector('.note').textContent =
      'These settings are the reference, so every difference is zero. Move a lever, or pin one set of settings and change another, to see the trade-off.'
  }
  requestAnimationFrame(() => barChart(el.querySelector('canvas'), items, FMT.people))
  return el
}

// ---------------------------------------------------------------- export
/** The selected city's indicators, one row per whole year. */
function downloadCSV() {
  const cols = [{ head: 'year', vals: Array.from(years) }]
  for (const d of DOMAINS) {
    for (const ch of d.charts) {
      for (const se of ch.series) {
        cols.push({ head: `${d.label} | ${ch.title} | ${se.label} (${ch.unit})`,
                    vals: se.calc(current, state.city) })
      }
    }
  }
  const rows = [cols.map(c => `"${c.head}"`).join(',')]
  years.forEach((y, i) => {
    if (!Number.isInteger(y)) return                 // annual rows, not every time step
    rows.push(cols.map(c => {
      const v = c.vals[i]
      return Number.isFinite(v) ? (c.head === 'year' ? v : Number(v.toPrecision(6))) : ''
    }).join(','))
  })
  const name = `gogreennext-${state.city}-${state.scenario}-policy${Math.round(state.values[POLICY_YEAR])}`
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = `${name}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// ---------------------------------------------------------------- guided tour
function applyTourStep(i) {
  const st = TOUR[i].state
  if (st.city) state.city = st.city
  if (st.scenario) {
    state.scenario = st.scenario
    state.values = { ...DEFAULTS, ...SCENARIOS[st.scenario],
                     [POLICY_YEAR]: st.policyYear ?? DEFAULTS[POLICY_YEAR] }
  }
  if (st.domain) { state.domain = st.domain; state.mode = 'city' }
  if (st.readoutYear) state.readoutYear = st.readoutYear
  state.pinned = null
}

function tourCard() {
  const i = state.tour, step = TOUR[i]
  const el = document.createElement('div')
  el.className = 'tour'
  el.innerHTML = `<div class="step">Guided tour · step ${i + 1} of ${TOUR.length}</div>
    <h3>${step.title}</h3><p>${step.text}</p>
    <div class="row">
      <button class="btn" ${i === 0 ? 'disabled' : ''} data-go="-1">Back</button>
      <button class="btn primary" data-go="1">${i === TOUR.length - 1 ? 'Finish' : 'Next'}</button>
      <button class="btn" data-go="0">Close</button>
      <span class="dots">${TOUR.map((_, k) =>
        `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
    </div>`
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const d = Number(b.dataset.go)
    if (d === 0 || i + d >= TOUR.length) { state.tour = null }
    else { state.tour = i + d; applyTourStep(state.tour) }
    render()
  })
  return el
}

/** The feedback that drives all of it, in words: the causal diagram is in Vensim. */
function loopsCard() {
  const el = document.createElement('div')
  el.className = 'card wide'
  el.innerHTML = `<details><summary><h3>Why it behaves like this</h3></summary>
    <div class="loops">${LOOPS.map(l => `
      <div class="loop"><span class="sign ${l.sign === 'R' ? 'r' : 'b'}">${l.sign}</span>
        <div><b>${l.name}</b><p>${l.text}</p></div></div>`).join('')}</div>
    <div class="note">R: a reinforcing loop, which compounds. B: a balancing loop, which
      pushes back. Capability and support are indices from 0 to 1, not measurements.</div>
    </details>`
  return el
}

// ---------------------------------------------------------------- views
function cityView(main) {
  main.appendChild(readout())

  const bar = document.createElement('div')
  bar.className = 'tabbar'
  bar.innerHTML = '<span class="lab">Indicators</span>'
  const tabs = document.createElement('div')
  tabs.className = 'tabs'
  tabs.setAttribute('role', 'tablist')
  for (const d of [...DOMAINS, { id: 'tradeoffs', label: 'Trade-offs' }]) {
    const b = document.createElement('button')
    b.className = 'tab'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', String(d.id === state.domain))
    b.textContent = d.label
    b.onclick = () => { state.domain = d.id; render() }
    tabs.appendChild(b)
  }
  bar.appendChild(tabs)
  main.appendChild(bar)

  const grid = document.createElement('div')
  grid.className = 'grid'
  if (state.domain === 'tradeoffs') {
    grid.appendChild(tradeoffCard())
    grid.appendChild(deltaCard())
  } else {
    const domain = DOMAINS.find(d => d.id === state.domain)
    for (const ch of domain.charts) grid.appendChild(card(ch, state.city))
    if (state.domain === 'engine') grid.appendChild(loopsCard())
  }
  main.appendChild(grid)
}

// one colour per city. The hypothetical city is deliberately grey: it is a reference
// point rather than a place, and should not read as a fifth pilot.
const CITY_COLOR = { Cork: 'cork', Klagenfurt: 'klag', Lahti: 'lahti', Malta: 'malta', Generic: 'hypo' }

function compareView(main) {
  const head = document.createElement('div')
  head.className = 'yearbar'
  head.innerHTML = `<span style="color:var(--muted)">Indicator</span>`
  const sel = document.createElement('select')
  sel.style.maxWidth = '340px'
  for (const c of COMPARE) sel.add(new Option(`${c.label} — ${c.unit}`, c.id))
  sel.value = state.compareId
  sel.onchange = () => { state.compareId = sel.value; render() }
  head.appendChild(sel)
  main.appendChild(head)

  const ind = COMPARE.find(c => c.id === state.compareId)
  const all = CITIES.map(c => ({
    city: c,
    values: ind.calc(current, c.id, c.population, c.rows.find(r => r.var === 'Population').values[0])
  }))

  const el = document.createElement('div')
  el.className = 'card wide'
  el.innerHTML = `<h3>${ind.label}</h3>
    <div class="unit">${ind.unit} — every city on one scale, same policy settings</div>
    <canvas></canvas>
    <div class="note">Differences come only from each city's own profile: where a value is
      still provisional, the cities barely differ. Pick a city below to open it.</div>`
  const canvas = el.querySelector('canvas')
  const series = all.map(a => ({
    label: a.city.id, color: CITY_COLOR[a.city.id], values: a.values
  }))
  const opts = {
    years, series, fmt: ind.fmt, tickFmt: TICK.get(ind.fmt),
    history: { from: START_YEAR, to: TODAY }, milestones: MILESTONES,
    policy: state.values[POLICY_YEAR]
  }
  const redraw = year => { const g = lineChart(canvas, opts); cursor(canvas, g, year, years); st.geom = g }
  const st = { years, series, fmt: ind.fmt, redraw, geom: null }
  requestAnimationFrame(() => redraw(null))
  attachHover(canvas, () => st)
  main.appendChild(el)

  // the legend is also the city picker, so the one panel keeps the click-through
  const leg = document.createElement('div')
  leg.className = 'citylegend'
  for (const a of all) {
    const b = document.createElement('button')
    if (a.city.id === state.city) b.className = 'sel'
    b.innerHTML = `<i style="background:var(--c-${CITY_COLOR[a.city.id]})"></i>${a.city.name}` +
                  ` <b>${ind.fmt(a.values[a.values.length - 1])}</b>`
    b.title = `Open ${a.city.name}`
    b.onclick = () => { state.city = a.city.id; state.mode = 'city'; render() }
    leg.appendChild(b)
  }
  main.appendChild(leg)

  const note = document.createElement('p')
  note.className = 'legend-note'
  note.style.marginTop = '12px'
  note.innerHTML = `Values shown are ${END_YEAR}. The hypothetical city (grey) is a reference `
    + 'point, not a fifth pilot. Capability and support are stylised indices, so they are not '
    + 'offered here: they explain the dynamics, they are not measurements.'
  main.appendChild(note)
}

// ---------------------------------------------------------------- render
let frameId = 0, frameOpts = {}
/** Coalesce a burst of slider events into a single redraw on the next frame. */
function scheduleRender(opts = {}) {
  frameOpts = { ...frameOpts, ...opts }
  if (frameId) return
  frameId = requestAnimationFrame(() => {
    frameId = 0
    const o = frameOpts; frameOpts = {}
    render(o)
  })
}

function render(opts = {}) {
  document.documentElement.dataset.theme = state.theme
  document.getElementById('theme-btn').textContent = state.theme === 'dark' ? 'Light' : 'Dark'
  document.querySelectorAll('#mode-seg button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)))
  document.getElementById('pin-btn').textContent = state.pinned ? 'Clear reference' : 'Pin as reference'

  compute()
  // while a slider is being dragged the sidebar is already correct, and rebuilding it
  // would throw away the control under the pointer
  if (opts.sidebar !== false) buildSidebar()

  const main = document.getElementById('main')
  main.innerHTML = ''
  if (state.tour !== null) main.appendChild(tourCard())

  // on a phone the sidebar is a drawer, so say here what is being shown
  const ctx = document.createElement('div')
  ctx.className = 'context'
  ctx.innerHTML = `<span><b>${cityOf(state.city).name}</b></span>`
    + `<span>${state.scenario}</span>`
    + `<span>policy from ${Math.round(state.values[POLICY_YEAR])}</span>`
  ctx.onclick = () => document.getElementById('controls-btn').click()
  main.appendChild(ctx)

  const c = cityOf(state.city)
  const provisional = c.rows.filter(r => r.tag === 'PROVISIONAL').length
  const banner = document.createElement('details')
  banner.className = 'banner'
  banner.open = window.innerWidth > 1080
  banner.innerHTML = `<summary><b>Read with care.</b> This is a model, not a measurement.</summary>
    <div>It is not calibrated to history yet: the run starts from ${c.name}'s profile at
    ${START_YEAR}, not from what actually happened. ${provisional} of ${c.rows.length} of this
    city's profile values are still provisional — the badges under City profile say which.
    Treat the shape of each curve, and the difference between policies, as the finding;
    not the third digit.</div>`
  main.appendChild(banner)

  if (state.mode === 'city') cityView(main)
  else compareView(main)
}

// ---------------------------------------------------------------- events
document.getElementById('theme-btn').onclick = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  remember('ggn-theme', state.theme)
  render()
}
document.querySelectorAll('#mode-seg button').forEach(b => b.onclick = () => {
  state.mode = b.dataset.mode; render()
})
document.getElementById('tour-btn').onclick = () => {
  state.tour = state.tour === null ? 0 : null
  if (state.tour !== null) {
    applyTourStep(0)
    document.body.classList.remove('controls-open')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  render()
}
document.getElementById('controls-btn').onclick = () => {
  const open = document.body.classList.toggle('controls-open')
  const b = document.getElementById('controls-btn')
  b.setAttribute('aria-expanded', String(open))
  b.textContent = open ? 'Hide controls' : 'Controls'
}
document.getElementById('pin-btn').onclick = () => {
  state.pinned = state.pinned ? null
    : { label: `${state.scenario} in ${cityOf(state.city).name}`, values: { ...state.values } }
  render()
}
document.getElementById('csv-btn').onclick = downloadCSV
document.getElementById('reset-btn').onclick = () => {
  state.values = { ...DEFAULTS }; state.scenario = 'Balanced'; state.pinned = null; render()
}
window.addEventListener('resize', () => clearTimeout(window._rs) || (window._rs = setTimeout(render, 150)))

// the model is loaded before the first render, so the app can be bundled as one
// classic script and opened from dist/index.html without a server
initModel().then(render).catch(err => {
  document.getElementById('main').innerHTML =
    `<div class="banner"><b>The model did not load.</b> ${err.message}</div>`
  console.error(err)
})
