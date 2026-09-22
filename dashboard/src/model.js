// Loads the SDEverywhere-compiled model and runs it. The model carries all five
// cities at once, so one run gives every city's results.
import loadGeneratedModel from '../build/model.js'
import { createSynchronousModelRunner } from '@sdeverywhere/runtime'
import spec from '../model.spec.json'

// Loaded by initModel(), not at import time: a top-level await cannot be bundled into
// the single classic script that lets dist/index.html open without a server.
let runner, outputs

// 'Green Cover[Cork,Deprived]' -> '_green_cover[_cork,_deprived]'
export const varId = name => {
  const [base, subs] = name.replace(']', '').split('[')
  const id = '_' + base.trim().toLowerCase().replace(/\s+/g, '_')
  if (!subs) return id
  return id + '[' + subs.split(',').map(s => '_' + s.trim().toLowerCase()).join(',') + ']'
}

export const INPUT_NAMES = spec.inputVarNames
export let years = []

/** Compile-time load of the generated model. Call once, before the first run. */
export async function initModel() {
  runner = createSynchronousModelRunner(await loadGeneratedModel())
  outputs = runner.createOutputs()
  years = outputs.getSeriesForVar(varId(spec.outputVarNames[0])).points.map(p => p.x)
}

/**
 * Run the model once. `values` maps input name -> value; missing ones use `defaults`.
 * The runner writes every run into the same output buffers, so each run is copied out
 * immediately: otherwise an accessor kept from an earlier run would silently return
 * the newest run's numbers.
 */
export function run(values, defaults) {
  runner.runModelSync(INPUT_NAMES.map(n => (n in values ? values[n] : defaults[n])), outputs)
  const snapshot = new Map()
  for (const name of spec.outputVarNames) {
    const series = outputs.getSeriesForVar(varId(name))
    if (series) snapshot.set(name.replace(/,\s+/g, ','), Float64Array.from(series.points, p => p.y))
  }
  const get = name => snapshot.get(name.replace(/,\s+/g, ',')) || null
  get.at = (name, year) => {
    const s = get(name)
    return s ? s[Math.round((year - years[0]) / (years[1] - years[0]))] : undefined
  }
  /** sum of a neighbourhood-subscripted variable across both neighbourhood types */
  get.both = (name, city) => {
    const a = get(`${name}[${city},Deprived]`), b = get(`${name}[${city},Other]`)
    return Float64Array.from(a, (v, i) => v + b[i])
  }
  return get
}
