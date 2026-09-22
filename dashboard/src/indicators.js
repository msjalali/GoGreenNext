// What each tab shows. A chart lists its series; a series reads the run through the
// accessor from model.js, so nothing here duplicates model logic.
const D = '[Deprived]', O = '[Other]'
const pct = (v, dp = 1) => (v * 100).toFixed(dp) + '%'
const num = (v, dp = 0) => v.toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp })

export const FMT = {
  pct: v => pct(v, 1),
  pct0: v => pct(v, 0),
  pp: v => (v * 100).toFixed(1) + ' pp',
  ha: v => num(v, 0) + ' ha',
  people: v => num(v, 0),
  peopleYr: v => num(v, 1) + '/yr',
  degC: v => v.toFixed(2) + ' °C',
  ugm3: v => v.toFixed(1),
  years: v => v.toFixed(1) + ' yr',
  money: v => '€' + num(v / 1000, 1) + 'm',
  index: v => v.toFixed(2),
}

// Axis ticks stay short; the unit is written once in the card header.
export const TICK = new Map([
  [FMT.pct, v => (v * 100).toFixed(0) + '%'],
  [FMT.pct0, v => (v * 100).toFixed(0) + '%'],
  [FMT.pp, v => (v * 100).toFixed(0)],
  [FMT.ha, v => Math.round(v).toLocaleString()],
  [FMT.people, v => Math.round(v).toLocaleString()],
  [FMT.peopleYr, v => v.toFixed(0)],
  [FMT.degC, v => v.toFixed(1)],
  [FMT.ugm3, v => v.toFixed(0)],
  [FMT.years, v => v.toFixed(0)],
  [FMT.money, v => (v / 1000).toFixed(1)],
  [FMT.index, v => v.toFixed(1)]
])

const city = (name, c) => `${name}[${c}]`
const nb = (name, c, n) => `${name}[${c},${n}]`

/** series helpers: each returns {label, color, calc(get, c)} */
const sCity = (label, name, color) => ({ label, color, calc: (g, c) => g(city(name, c)) })
const sNb = (label, name, n, color) => ({ label, color, calc: (g, c) => g(nb(name, c, n)) })
const sBoth = (label, name, color) => ({ label, color, calc: (g, c) => g.both(name, c) })

export const DOMAINS = [
  {
    id: 'climate', label: 'Climate & ecosystem',
    charts: [
      {
        title: 'Green cover', unit: 'share of land', fmt: FMT.pct,
        note: 'All vegetation, not only parks. The dashed line is the 30% canopy target of the '
            + '3-30-300 rule, which the EU biodiversity strategy asks cities to reach by 2030.',
        target: { value: 0.3, label: '30% target (3-30-300)' },
        series: [sCity('citywide', 'City Green Cover', 'city'),
                 sNb('deprived areas', 'Green Cover', 'Deprived', 'dep'),
                 sNb('rest of city', 'Green Cover', 'Other', 'oth')]
      },
      {
        title: 'Habitat value of that green', unit: 'share of land, quality-weighted', fmt: FMT.pct,
        note: 'Where capability shows up as biodiversity: well-designed NBS count for more.',
        series: [sNb('deprived areas', 'Habitat Cover', 'Deprived', 'dep'),
                 sNb('rest of city', 'Habitat Cover', 'Other', 'oth')]
      },
      {
        title: 'Fine particles (PM2.5)', unit: 'µg/m³', fmt: FMT.ugm3,
        note: 'Greening barely moves this. The clean-air lever does. WHO guideline: 5.',
        target: { value: 5, label: 'WHO guideline' },
        series: [sNb('deprived areas', 'Fine Particulate Concentration', 'Deprived', 'dep'),
                 sNb('rest of city', 'Fine Particulate Concentration', 'Other', 'oth')]
      },
      {
        title: 'Summer cooling from green cover', unit: '°C below a city with no green', fmt: FMT.degC,
        note: 'Urban heat islands run about 1.5 °C (Iungman et al. 2023).',
        series: [sNb('deprived areas', 'Summer Cooling from Green Cover', 'Deprived', 'dep'),
                 sNb('rest of city', 'Summer Cooling from Green Cover', 'Other', 'oth')]
      }
    ]
  },
  {
    id: 'health', label: 'Health',
    charts: [
      {
        title: 'Premature deaths avoided', unit: 'people a year', fmt: FMT.peopleYr,
        note: 'Through cooling and through residential greenness.',
        series: [sBoth('citywide', 'Premature Deaths Avoided by Green Cover', 'city')]
      },
      {
        title: 'Poor mental health avoided', unit: 'people', fmt: FMT.people,
        note: 'The WP6 primary outcome: residents who would otherwise have depression or anxiety.',
        series: [sBoth('citywide', 'Poor Mental Health Cases Avoided', 'city')]
      },
      {
        title: 'Green space within reach', unit: 'share of residents', fmt: FMT.pct,
        note: 'Green space within 300 m, the third number in the 3-30-300 rule. '
            + 'Calibrated to the ISGlobal measurement for each pilot.',
        series: [sNb('deprived areas', 'Green Space Access', 'Deprived', 'dep'),
                 sNb('rest of city', 'Green Space Access', 'Other', 'oth')]
      },
      {
        title: 'Residents who actually use it', unit: 'share of residents', fmt: FMT.pct,
        note: 'Access sets the ceiling; habit and programmes decide how much of it is used.',
        series: [sNb('deprived areas', 'Use of Green Space', 'Deprived', 'dep'),
                 sNb('rest of city', 'Use of Green Space', 'Other', 'oth')]
      }
    ]
  },
  {
    id: 'justice', label: 'Justice',
    charts: [
      {
        title: 'The green cover gap', unit: 'deprived minus rest of city', fmt: FMT.pp,
        note: 'Below zero means deprived areas are greener than the rest.',
        zero: true,
        series: [{ label: 'gap', color: 'city', calc: (g, c) => g(city('Green Cover Gap', c)).map(v => -v) }]
      },
      {
        title: 'Residents displaced by green gentrification', unit: 'people, cumulative', fmt: FMT.people,
        note: 'Greening deprived areas without safeguards pushes residents out.',
        series: [sCity('displaced', 'Residents Displaced by Green Gentrification', 'dep')]
      },
      {
        title: 'Use of green space, deprived vs rest', unit: 'share of residents', fmt: FMT.pct,
        note: 'The justice question behind the health numbers.',
        series: [sNb('deprived areas', 'Use of Green Space', 'Deprived', 'dep'),
                 sNb('rest of city', 'Use of Green Space', 'Other', 'oth')]
      },
      {
        title: 'PM2.5, deprived vs rest', unit: 'µg/m³', fmt: FMT.ugm3,
        note: 'Deprived areas start more polluted in every pilot.',
        series: [sNb('deprived areas', 'Fine Particulate Concentration', 'Deprived', 'dep'),
                 sNb('rest of city', 'Fine Particulate Concentration', 'Other', 'oth')]
      }
    ]
  },
  {
    id: 'integration', label: 'Integration',
    charts: [
      {
        title: 'Share of NBS money from other sectors', unit: 'share of all NBS resources', fmt: FMT.pct,
        note: 'Water, health, transport and housing co-funding. It grows only when NBS visibly delivers.',
        series: [sCity('other sectors', 'Share of NBS Resources from Other Sectors', 'city')]
      },
      {
        title: 'Money available for NBS', unit: '€ million a year', fmt: FMT.money,
        note: 'The city’s own budget plus what integration brings in.',
        series: [sCity('all resources', 'Total NBS Resources', 'city'),
                 sCity('from other sectors', 'Funding from Other Sectors', 'oth')]
      }
    ]
  },
  {
    id: 'transform', label: 'Transformative potential',
    charts: [
      {
        title: 'Progress to the green cover target', unit: 'share of the target reached', fmt: FMT.pct,
        note: 'The dashed line is the target itself.',
        target: { value: 1, label: 'target reached' },
        series: [sCity('progress', 'Progress to Green Cover Target', 'city')]
      },
      {
        title: 'How long new green space lasts', unit: 'years', fmt: FMT.years,
        note: 'Quality made tangible. Street trees in Europe last 19–28 years.',
        series: [sCity('expected lifetime', 'Expected NBS Lifetime', 'city')]
      },
      {
        title: 'Municipal capability', unit: '0 to 1, share of best practice', fmt: FMT.index,
        note: 'Stylised, not measurable: read it as the delivery organisation’s strength.',
        series: [sCity('capability', 'Municipal NBS Capability', 'city')]
      },
      {
        title: 'Public and political support', unit: '0 to 1', fmt: FMT.index,
        note: 'Support follows visible delivery, and decays when NBS causes harm.',
        series: [sCity('support', 'Public and Political Support for NBS', 'city')]
      }
    ]
  },
  {
    id: 'engine', label: 'Delivery engine',
    charts: [
      {
        title: 'Public green space', unit: 'hectares', fmt: FMT.ha,
        note: 'The stock the city manages.',
        series: [sCity('citywide', 'Total Functioning NBS', 'city'),
                 sNb('deprived areas', 'Functioning NBS', 'Deprived', 'dep'),
                 sNb('rest of city', 'Functioning NBS', 'Other', 'oth')]
      },
      {
        title: 'Built versus lost each year', unit: 'hectares a year', fmt: FMT.ha,
        note: 'When the two lines meet, the city is standing still. This is why a policy can shrink the estate.',
        series: [sBoth('built', 'NBS Implementation', 'city'),
                 sBoth('lost', 'Loss of Functionality', 'dep')]
      },
      {
        title: 'Where the money goes', unit: '€ million a year', fmt: FMT.money,
        note: 'Rollout builds hectares; capability builds the organisation; programmes bring people in.',
        series: [
          { label: 'rollout', color: 'city',
            calc: (g, c) => g(city('Resources for NBS Delivery', c))
              .map((v, i) => v * g(city('Share of Resources to Rollout', c))[i]) },
          { label: 'capability', color: 'oth', calc: (g, c) => g(city('Capability Improvement Effort', c)) },
          { label: 'nature programmes', color: 'dep', calc: (g, c) => g(city('Nature Programme Spending', c)) }
        ]
      },
      {
        title: 'Performance against ambition', unit: '0 to 1', fmt: FMT.index,
        note: 'The shortfall between the two drives how the city splits its money.',
        series: [sCity('realised', 'Realized NBS Performance', 'city'),
                 sCity('desired', 'Desired NBS Performance', 'oth')]
      }
    ]
  }
]

// Headline numbers in the readout strip, and the indicators offered in compare mode.
export const HEADLINES = [
  { id: 'green', label: 'Green cover', fmt: FMT.pct, calc: (g, c) => g(city('City Green Cover', c)) },
  { id: 'ha', label: 'Public green', fmt: FMT.ha, calc: (g, c) => g(city('Total Functioning NBS', c)) },
  { id: 'deaths', label: 'Deaths avoided', fmt: FMT.peopleYr, calc: (g, c) => g.both('Premature Deaths Avoided by Green Cover', c) },
  { id: 'mental', label: 'Poor mental health avoided', fmt: FMT.people, calc: (g, c) => g.both('Poor Mental Health Cases Avoided', c) },
  { id: 'gap', label: 'Green cover gap', fmt: FMT.pp, calc: (g, c) => g(city('Green Cover Gap', c)).map(v => -v), lowerIsBetter: true },
  { id: 'displaced', label: 'Residents displaced', fmt: FMT.people, calc: (g, c) => g(city('Residents Displaced by Green Gentrification', c)), lowerIsBetter: true }
]

export const COMPARE = [
  { id: 'green', label: 'Green cover', unit: 'share of land', fmt: FMT.pct, calc: (g, c) => g(city('City Green Cover', c)) },
  { id: 'haCap', label: 'Public green per 1,000 residents', unit: 'ha', fmt: v => v.toFixed(1) + ' ha',
    calc: (g, c, pop) => g(city('Total Functioning NBS', c)).map(v => v / pop * 1000) },
  { id: 'deaths', label: 'Deaths avoided', unit: 'per 100,000 residents a year', fmt: v => v.toFixed(1),
    calc: (g, c, pop) => g.both('Premature Deaths Avoided by Green Cover', c).map(v => v / pop * 1e5) },
  { id: 'mental', label: 'Poor mental health avoided', unit: 'per 100,000 residents', fmt: v => v.toFixed(0),
    calc: (g, c, pop) => g.both('Poor Mental Health Cases Avoided', c).map(v => v / pop * 1e5) },
  { id: 'access', label: 'Green space within reach', unit: 'share of residents, deprived areas', fmt: FMT.pct,
    calc: (g, c) => g(nb('Green Space Access', c, 'Deprived')) },
  { id: 'use', label: 'Use of green space', unit: 'share of residents, deprived areas', fmt: FMT.pct,
    calc: (g, c) => g(nb('Use of Green Space', c, 'Deprived')) },
  { id: 'pm', label: 'PM2.5', unit: 'µg/m³, deprived areas', fmt: FMT.ugm3,
    calc: (g, c) => g(nb('Fine Particulate Concentration', c, 'Deprived')) },
  { id: 'gap', label: 'Green cover gap', unit: 'deprived minus rest', fmt: FMT.pp,
    calc: (g, c) => g(city('Green Cover Gap', c)).map(v => -v) },
  { id: 'displaced', label: 'Residents displaced', unit: 'per 1,000 deprived residents', fmt: v => v.toFixed(0),
    calc: (g, c, pop, depPop) => g(city('Residents Displaced by Green Gentrification', c)).map(v => v / depPop * 1000) },
  { id: 'other', label: 'Money from other sectors', unit: 'share of NBS resources', fmt: FMT.pct,
    calc: (g, c) => g(city('Share of NBS Resources from Other Sectors', c)) }
]

export const SCENARIOS = {
  'Balanced': {},
  'Build fast': { 'Maximum Rollout Share': 0.95, 'Pressure at Half Share': 0.2 },
  'Capability first': { 'Maximum Rollout Share': 0.5, 'Pressure at Half Share': 0.6 },
  'High staff turnover': { 'Staff and Knowledge Loss': 0.12 },
  'Deprived areas first': { 'Share of New NBS in Deprived Areas': 0.6 },
  'Deprived first + safeguards': { 'Share of New NBS in Deprived Areas': 0.6, 'Displacement Safeguards': 0.8 },
  'Integrated': { 'Cross Sectoral Integration': 0.8 },
  'Nature programmes (10%)': { 'Share of Resources to Nature Programmes': 0.1 },
  'Clean-air policy (30%)': { 'Clean Air Policy Emission Cut': 0.3 }
}

// The proposal asks for learning sequences, not just controls: seven steps that walk
// through the five indicator domains and end on the two findings that are the point
// of the model -- the equity backfire, and that when a city acts matters.
export const TOUR = [
  {
    title: 'Where the numbers start',
    text: 'Every run starts from the city’s own profile in 2012 and the shaded years are its history. ' +
          'The model is not calibrated to them yet, so nothing you change here can move them. ' +
          'In the sidebar, a badge on each profile value says whether it is measured city data or still provisional.',
    state: { city: 'Cork', scenario: 'Balanced', domain: 'climate', readoutYear: 2026 }
  },
  {
    title: 'Scaling fast is not the same as scaling well',
    text: 'This city spends nearly everything on new green space and little on the capability to look after it. ' +
          'Capability falls, decay outruns delivery, and the expected life of what it builds drops with it. ' +
          'It is ahead early and behind later.',
    state: { scenario: 'Build fast', domain: 'engine', readoutYear: 2075 }
  },
  {
    title: 'What it is for: health',
    text: 'Green space avoids premature deaths through summer cooling and through residential greenness, ' +
          'and avoids poor mental health through people actually using it — the WP6 primary outcome.',
    state: { scenario: 'Balanced', domain: 'health', readoutYear: 2050 }
  },
  {
    title: 'Equity, and its backfire',
    text: 'Send most new green space to deprived neighbourhoods and the green cover gap closes almost completely. ' +
          'But more residents are displaced by green gentrification: the unintended consequence the proposal names. ' +
          'Greening a neighbourhood makes it more desirable to people who can outbid the people already there.',
    state: { scenario: 'Deprived areas first', domain: 'justice', readoutYear: 2075 }
  },
  {
    title: 'And how to head it off',
    text: 'The same targeting, with rent protection, social housing and community land trusts alongside it. ' +
          'The gap still closes and displacement roughly halves. Equity is not one lever; it is two, used together.',
    state: { scenario: 'Deprived first + safeguards', domain: 'justice', readoutYear: 2075 }
  },
  {
    title: 'Integration buys scale',
    text: 'When water, health, transport and housing co-plan and co-fund, other sectors pay for a fifth of the work — ' +
          'but only while NBS visibly delivers for them. It is the strongest lever in the model for growing the estate, ' +
          'and the only one that does.',
    state: { scenario: 'Integrated', domain: 'integration', readoutYear: 2075 }
  },
  {
    title: 'When a city acts',
    text: 'The same safeguards again, but not started until 2040. The estate ends up no smaller — ' +
          'slightly larger, even, since the city spread its greening more widely for another 13 years. ' +
          'Yet more residents were displaced in the meantime, and no later policy brings them back. ' +
          'Delay is cheap in hectares and expensive in people. Try Compare cities next, ' +
          'to see the same policy in all five.',
    state: { city: 'Cork', scenario: 'Deprived first + safeguards', domain: 'justice',
             readoutYear: 2075, policyYear: 2040 }
  }
]

// Why the engine behaves as it does, in words. A policy audience meeting a system
// dynamics model asks this first, and the causal diagram is not in the browser.
export const LOOPS = [
  { sign: 'R', name: 'Delivery pays for itself, a little',
    text: 'Money buys new green space; green space delivers cooling, health and habitat; ' +
          'visible delivery earns public and political support, which protects the budget ' +
          'and attracts other sectors. Reinforcing, but weak: support moves slowly.' },
  { sign: 'B', name: 'Capability drag',
    text: 'Every euro spent rolling out is a euro not spent on the capability to design and ' +
          'maintain. Low capability means lower quality, faster decay and shorter-lived assets, ' +
          'so the estate needs more rollout to stand still. Scaling fast makes this worse, which ' +
          'is why Build fast is ahead early and behind later.' },
  { sign: 'B', name: 'Green gentrification',
    text: 'Greening a deprived neighbourhood makes it more desirable, and some original residents ' +
          'are outbid and displaced. The gap closes on the map while the people it was meant for ' +
          'leave. Safeguards weaken this link; they do not remove it.' },
  { sign: 'R', name: 'Other sectors join in',
    text: 'Water, health, transport and housing co-fund NBS when there is an institutional route ' +
          '(integration) and NBS visibly delivers for them (performance). More money means more ' +
          'delivery means more co-funding — the only loop in the model that grows the estate.' }
]
