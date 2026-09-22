// Canvas charts: time series (with history shading, milestones, target lines and a
// pinned comparison), bars and a scatter. No chart library; colours come from the CSS
// variables so themes just work.

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const COLOR = () => ({
  dep: css('--c-dep'), oth: css('--c-oth'), city: css('--c-city'),
  cork: css('--c-cork'), klag: css('--c-klag'), lahti: css('--c-lahti'), malta: css('--c-malta'),
  ink: css('--ink'), muted: css('--muted'), grid: css('--grid'),
  surface: css('--surface'), shade: css('--shade'), accent: css('--accent')
})

function setup(canvas) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height))
  canvas.width = w * dpr; canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  return { ctx, w, h }
}

const niceStep = span => {
  const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  return [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10
}

/**
 * options: {years, series:[{label,color,values}], fmt, target, zero, pinned,
 *           history:{from,to}, milestones:[years], policy:year, compact, title}
 */
export function lineChart(canvas, o) {
  const { ctx, w, h } = setup(canvas)
  const C = COLOR()
  const pad = o.compact
    ? { l: 34, r: 8, t: 8, b: 18 }
    : { l: 52, r: 74, t: 10, b: 24 }
  const x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b
  const years = o.years
  const all = []
  for (const s of o.series) for (const v of s.values) if (Number.isFinite(v)) all.push(v)
  for (const s of o.pinned || []) for (const v of s.values) if (Number.isFinite(v)) all.push(v)
  if (o.target) all.push(o.target.value)
  let lo = o.forceLo ?? Math.min(...all), hi = o.forceHi ?? Math.max(...all)
  if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0) }
  if (!(hi > lo)) { hi = lo + 1 }
  const step = niceStep(hi - lo)
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step
  if (lo > 0 && lo < step) lo = 0

  const X = yr => x0 + (yr - years[0]) / (years[years.length - 1] - years[0]) * (x1 - x0)
  const Y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0)

  // history shading
  if (o.history) {
    ctx.fillStyle = C.shade
    ctx.fillRect(X(o.history.from), y0, X(o.history.to) - X(o.history.from), y1 - y0)
    if (!o.compact) {
      ctx.fillStyle = C.muted
      ctx.textAlign = 'left'
      ctx.fillText('history', X(o.history.from) + 6, y0 + 12)
    }
  }
  // grid + y labels
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  for (let v = lo; v <= hi + 1e-9; v += step) {
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x0, Math.round(Y(v)) + 0.5); ctx.lineTo(x1, Math.round(Y(v)) + 0.5); ctx.stroke()
    ctx.fillStyle = C.muted
    const tf = o.tickFmt || o.fmt
    ctx.fillText(tf ? tf(v) : String(v), x0 - 6, Y(v))
  }
  // milestones
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  for (const m of o.milestones || []) {
    if (m <= years[0] || m >= years[years.length - 1]) continue
    ctx.strokeStyle = C.grid; ctx.setLineDash([2, 3]); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(X(m), y0); ctx.lineTo(X(m), y1); ctx.stroke(); ctx.setLineDash([])
    if (!o.compact) { ctx.fillStyle = C.muted; ctx.fillText(String(m), X(m), y1 + 5) }
  }
  // the year the levers take effect: everything left of it is the city's own history
  if (o.policy > years[0] && o.policy < years[years.length - 1]) {
    ctx.strokeStyle = C.accent; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(X(o.policy), y0); ctx.lineTo(X(o.policy), y1); ctx.stroke()
    ctx.setLineDash([])
    if (!o.compact && x1 - x0 > 260) {
      ctx.fillStyle = C.accent; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(`policy ${Math.round(o.policy)}`, X(o.policy) + 4, y0 + 1)
    }
  }
  // x labels
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  if (!o.compact) {
    ctx.fillStyle = C.muted
    ctx.fillText(String(years[0]), x0, y1 + 5)
    ctx.fillText(String(years[years.length - 1]), x1, y1 + 5)
  }
  // target line
  if (o.target && o.target.value >= lo && o.target.value <= hi) {
    ctx.strokeStyle = C.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x0, Y(o.target.value)); ctx.lineTo(x1, Y(o.target.value)); ctx.stroke()
    ctx.setLineDash([])
    if (!o.compact) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillStyle = C.muted; ctx.fillText(o.target.label, x0 + 4, Y(o.target.value) - 2)
    }
  }
  const draw = (s, dashed) => {
    ctx.strokeStyle = C[s.color] || s.color
    ctx.lineWidth = dashed ? 1.5 : 2
    ctx.setLineDash(dashed ? [5, 4] : [])
    ctx.globalAlpha = dashed ? 0.65 : 1
    ctx.beginPath()
    years.forEach((yr, i) => {
      const v = s.values[i]
      if (!Number.isFinite(v)) return
      i ? ctx.lineTo(X(yr), Y(v)) : ctx.moveTo(X(yr), Y(v))
    })
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1
  }
  for (const s of o.pinned || []) draw(s, true)
  for (const s of o.series) draw(s, false)

  // direct end labels
  if (!o.compact) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    const placed = []
    for (const s of o.series) {
      const v = s.values[s.values.length - 1]
      if (!Number.isFinite(v)) continue
      let y = Y(v)
      while (placed.some(p => Math.abs(p - y) < 12)) y += 12
      placed.push(y)
      ctx.fillStyle = C[s.color] || s.color
      ctx.fillText(s.label, x1 + 6, y)
    }
  }
  return { X, Y, x0, x1, y0, y1, lo, hi }
}

/** Hover readout: attaches a crosshair + tooltip to a time-series canvas. */
export function attachHover(canvas, getState) {
  const tip = document.createElement('div')
  tip.className = 'tooltip'
  tip.hidden = true
  canvas.parentElement.appendChild(tip)
  const move = ev => {
    const st = getState()
    if (!st) return
    const rect = canvas.getBoundingClientRect()
    const px = ev.clientX - rect.left
    const { years, series, fmt, geom } = st
    if (!geom || px < geom.x0 - 4 || px > geom.x1 + 4) { tip.hidden = true; return }
    const t = (px - geom.x0) / (geom.x1 - geom.x0)
    const i = Math.max(0, Math.min(years.length - 1, Math.round(t * (years.length - 1))))
    st.redraw(years[i])
    tip.hidden = false
    tip.innerHTML = `<b>${years[i]}</b>` + series.map(s =>
      `<span><i style="background:${getComputedStyle(document.documentElement).getPropertyValue('--c-' + s.color).trim() || s.color}"></i>` +
      `${s.label} <b>${fmt ? fmt(s.values[i]) : s.values[i].toFixed(2)}</b></span>`).join('')
    const left = Math.min(px + 12, rect.width - tip.offsetWidth - 8)
    tip.style.left = Math.max(4, left) + 'px'
    tip.style.top = '8px'
  }
  canvas.addEventListener('mousemove', move)
  canvas.addEventListener('mouseleave', () => {
    tip.hidden = true
    const st = getState(); if (st) st.redraw(null)
  })
}

/** Vertical cursor drawn on top of a chart, for the hover readout. */
export function cursor(canvas, geom, year, years) {
  if (year == null || !geom) return
  const ctx = canvas.getContext('2d')
  const C = COLOR()
  ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.6; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(geom.X(year), geom.y0); ctx.lineTo(geom.X(year), geom.y1); ctx.stroke()
  ctx.globalAlpha = 1
}

/** Horizontal bars, signed: what a policy buys (right) and what it costs (left). */
export function barChart(canvas, items, fmt) {
  const { ctx, w, h } = setup(canvas)
  const C = COLOR()
  const padL = 190, padR = 70, top = 6
  const rowH = Math.min(30, (h - top) / Math.max(items.length, 1))
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1e-9)
  const mid = padL + (w - padL - padR) / 2
  ctx.textBaseline = 'middle'
  items.forEach((it, k) => {
    const y = top + k * rowH + rowH / 2
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'
    ctx.fillText(it.label, padL - 10, y)
    const len = Math.abs(it.value) / max * (w - padL - padR) / 2
    const good = it.good
    ctx.fillStyle = good ? C.city : C.dep
    ctx.globalAlpha = 0.85
    const x = it.value >= 0 ? mid : mid - len
    ctx.fillRect(x, y - rowH * 0.28, len, rowH * 0.56)
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink
    ctx.fillText((it.value >= 0 ? '+' : '−') + (it.fmt || fmt)(Math.abs(it.value)), w - padR + 8, y)
  })
  ctx.strokeStyle = C.grid
  ctx.beginPath(); ctx.moveTo(mid, top); ctx.lineTo(mid, top + items.length * rowH); ctx.stroke()
}

/** Trade-off scatter: one point per policy. */
export function scatter(canvas, o) {
  const { ctx, w, h } = setup(canvas)
  const C = COLOR()
  const pad = { l: 56, r: 16, t: 14, b: 34 }
  const xs = o.points.map(p => p.x), ys = o.points.map(p => p.y)
  const pad10 = (a, b) => { const d = (b - a) || Math.abs(a) || 1; return [a - d * 0.12, b + d * 0.18] }
  const [xlo, xhi] = pad10(Math.min(...xs), Math.max(...xs))
  const [ylo, yhi] = pad10(Math.min(...ys), Math.max(...ys))
  const X = v => pad.l + (v - xlo) / (xhi - xlo) * (w - pad.l - pad.r)
  const Y = v => h - pad.b - (v - ylo) / (yhi - ylo) * (h - pad.t - pad.b)
  ctx.strokeStyle = C.grid
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke()
  ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText(o.xLabel, (pad.l + w - pad.r) / 2, h - 14)
  ctx.save(); ctx.translate(12, (pad.t + h - pad.b) / 2); ctx.rotate(-Math.PI / 2)
  ctx.fillText(o.yLabel, 0, 0); ctx.restore()
  // labels: keep them apart, and put them left of the dot when it is near the edge
  const placed = o.points
    .map(p => ({ p, px: X(p.x), py: Y(p.y), ly: Y(p.y) }))
    .sort((a, b) => a.ly - b.ly)
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].ly - placed[i - 1].ly < 13) placed[i].ly = placed[i - 1].ly + 13
  }
  for (const { p, px, py, ly } of placed) {
    ctx.fillStyle = p.highlight ? C.accent : C.city
    ctx.globalAlpha = p.highlight ? 1 : 0.7
    ctx.beginPath(); ctx.arc(px, py, p.highlight ? 6 : 4.5, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    const width = ctx.measureText(p.label).width
    const right = px + 9 + width < w - pad.r
    ctx.strokeStyle = C.grid
    if (Math.abs(ly - py) > 2) {                 // leader line to the moved label
      ctx.beginPath(); ctx.moveTo(px + (right ? 5 : -5), py)
      ctx.lineTo(px + (right ? 8 : -8), ly); ctx.stroke()
    }
    ctx.fillStyle = p.highlight ? C.accent : C.ink
    ctx.textAlign = right ? 'left' : 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.label, px + (right ? 9 : -9), ly)
  }
}
