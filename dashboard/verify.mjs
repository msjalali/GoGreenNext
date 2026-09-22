// Checks the SDEverywhere-compiled model against the Python simulator that reads the
// .mdl directly (tools/mdlsim.py). Run with: npm run verify
import loadGeneratedModel from './build/model.js'
import { createSynchronousModelRunner } from '@sdeverywhere/runtime'
import spec from './model.spec.json' with { type: 'json' }

const runner = createSynchronousModelRunner(await loadGeneratedModel())
const outputs = runner.createOutputs()
const varId = name => {
  const [base, subs] = name.replace(']', '').split('[')
  const id = '_' + base.trim().toLowerCase().replace(/\s+/g, '_')
  return subs ? id + '[' + subs.split(',').map(s => '_' + s.trim().toLowerCase()).join(',') + ']' : id
}

// defaults, in the order the spec lists them
const DEFAULTS = {
  'Policy Start Year': 2027, 'Budget Change from Policy Start': 1,
  'Share of New NBS in Deprived Areas': 0.2, 'Displacement Safeguards': 0.2,
  'Cross Sectoral Integration': 0.2, 'Share of Resources to Nature Programmes': 0,
  'Clean Air Policy Emission Cut': 0, 'Maximum Rollout Share': 0.7,
  'Pressure at Half Share': 0.35, 'Staff and Knowledge Loss': 0.05, 'Ambition Scale': 0.9,
  'Green Cover Target': 0.3,
  'Mortality Reduction per Unit Green Cover': 0.2, 'Summer Cooling per Unit Green Cover': 2,
  'Heat Mortality Reduction per Degree': 0.007, 'Mental Health Risk Reduction from Nature Use': 0.25,
  'Municipal NBS Budget[Generic]': 14400, 'Municipal NBS Budget[Cork]': 10461,
  'Municipal NBS Budget[Klagenfurt]': 5622, 'Municipal NBS Budget[Lahti]': 6538,
  'Municipal NBS Budget[Malta]': 22098,
  'Delivery Cost per Hectare[Generic]': 200, 'Delivery Cost per Hectare[Cork]': 192.6,
  'Delivery Cost per Hectare[Klagenfurt]': 223.4, 'Delivery Cost per Hectare[Lahti]': 222.8,
  'Delivery Cost per Hectare[Malta]': 169.6
}
const SCEN = {
  'Balanced': {},
  'Integrated': { 'Cross Sectoral Integration': 0.8 },
  'Nature programmes (10%)': { 'Share of Resources to Nature Programmes': 0.1 },
  'Deprived first + safeguards': { 'Share of New NBS in Deprived Areas': 0.6, 'Displacement Safeguards': 0.8 }
}
// 2075 values from tools/mdlsim.py, which runs NBS_Scaling_Quanti_v8.mdl directly,
// with the default policy timing: each scenario's levers take effect in 2027
const EXPECT = {
  'Generic|Balanced': { nbs: 283.3776, cover: 0.218459, deaths: 67.2738, mental: 500.698, displaced: 4471.41 },
  'Generic|Integrated': { nbs: 305.1619, cover: 0.225721, deaths: 69.5643, mental: 513.575, displaced: 4679.21 },
  'Generic|Nature programmes (10%)': { nbs: 267.6635, cover: 0.213221, deaths: 65.6190, mental: 507.651, displaced: 4322.68 },
  'Generic|Deprived first + safeguards': { nbs: 258.0375, cover: 0.210013, deaths: 67.3320, mental: 498.476, displaced: 2900.54 },
  'Cork|Balanced': { nbs: 330.8586, cover: 0.198421, deaths: 65.9278, mental: 430.729, displaced: 4819.56 },
  'Cork|Integrated': { nbs: 372.8390, cover: 0.207863, deaths: 69.1656, mental: 446.897, displaced: 5201.20 },
  'Cork|Nature programmes (10%)': { nbs: 300.8190, cover: 0.191664, deaths: 63.6078, mental: 428.028, displaced: 4537.53 },
  'Cork|Deprived first + safeguards': { nbs: 288.1136, cover: 0.188806, deaths: 65.4575, mental: 426.092, displaced: 3143.07 },
  'Klagenfurt|Balanced': { nbs: 153.2989, cover: 0.198417, deaths: 46.0263, mental: 554.948, displaced: 2232.60 },
  'Klagenfurt|Integrated': { nbs: 172.7505, cover: 0.207859, deaths: 48.2868, mental: 571.986, displaced: 2409.41 },
  'Klagenfurt|Nature programmes (10%)': { nbs: 139.3804, cover: 0.191660, deaths: 44.4066, mental: 547.009, displaced: 2101.94 },
  'Klagenfurt|Deprived first + safeguards': { nbs: 133.4987, cover: 0.188805, deaths: 45.6978, mental: 552.264, displaced: 1456.02 },
  'Lahti|Balanced': { nbs: 178.7488, cover: 0.198430, deaths: 65.8723, mental: 1557.099, displaced: 2605.06 },
  'Lahti|Integrated': { nbs: 201.4276, cover: 0.207872, deaths: 69.1071, mental: 1580.133, displaced: 2811.27 },
  'Lahti|Nature programmes (10%)': { nbs: 162.5199, cover: 0.191674, deaths: 63.5542, mental: 1549.007, displaced: 2452.65 },
  'Lahti|Deprived first + safeguards': { nbs: 155.6396, cover: 0.188809, deaths: 65.4037, mental: 1561.425, displaced: 1698.78 },
  'Malta|Balanced': { nbs: 793.7159, cover: 0.198417, deaths: 155.9659, mental: 1014.147, displaced: 11558.76 },
  'Malta|Integrated': { nbs: 894.4276, cover: 0.207859, deaths: 163.6255, mental: 1050.924, displaced: 12474.12 },
  'Malta|Nature programmes (10%)': { nbs: 721.6504, cover: 0.191660, deaths: 150.4772, mental: 1046.153, displaced: 10882.31 },
  'Malta|Deprived first + safeguards': { nbs: 691.1875, cover: 0.188804, deaths: 154.8528, mental: 1004.593, displaced: 7538.16 }
}

const last = name => {
  const s = outputs.getSeriesForVar(varId(name))
  return s.points[s.points.length - 1].y
}
const both = (name, city) => last(`${name}[${city},Deprived]`) + last(`${name}[${city},Other]`)

console.log('SDEverywhere-compiled v8 against the Python reference (2075)\n')
let worst = 0, worstKey = ''
for (const [key, e] of Object.entries(EXPECT)) {
  const [cityName, scen] = key.split('|')
  const vals = { ...DEFAULTS, ...SCEN[scen] }
  runner.runModelSync(spec.inputVarNames.map(n => vals[n]), outputs)
  const got = {
    nbs: last(`Total Functioning NBS[${cityName}]`),
    cover: last(`City Green Cover[${cityName}]`),
    deaths: both('Premature Deaths Avoided by Green Cover', cityName),
    mental: both('Poor Mental Health Cases Avoided', cityName),
    displaced: last(`Residents Displaced by Green Gentrification[${cityName}]`)
  }
  for (const k of Object.keys(e)) {
    const rel = Math.abs(got[k] - e[k]) / Math.max(Math.abs(e[k]), 1e-9)
    if (rel > worst) { worst = rel; worstKey = `${key} ${k}` }
  }
  console.log(`  ${key.padEnd(42)} ${got.nbs.toFixed(1).padStart(7)} ha` +
              `   deaths ${got.deaths.toFixed(1).padStart(5)}/yr   mental ${got.mental.toFixed(0).padStart(5)}` +
              `   displaced ${got.displaced.toFixed(0).padStart(6)}`)
}
const startYear = outputs.getSeriesForVar(varId(spec.outputVarNames[0])).points[0].x
console.log(`\n  time axis starts at ${startYear}`)
console.log(`  worst relative difference: ${(worst * 100).toFixed(4)}%  (${worstKey})`)
const endYear = outputs.getSeriesForVar(varId(spec.outputVarNames[0])).points.at(-1).x
console.log(`  time axis ends at ${endYear}`)
const ok = worst < 2e-4 && startYear === 2012 && endYear === 2075
console.log('  ' + (ok ? 'MATCH — the dashboard runs the same model as the verification suite' : 'MISMATCH'))
process.exit(ok ? 0 : 1)
