import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { L1_WAVELENGTH_M } from '../../lib/beamforming'
import { computeLab, DEFAULT_PARAMS, LAB_GRID, PRESETS, SAT_SNR_DB, type LabParams, type Method } from '../../lib/labModel'
import { hasWebGL } from '../../lib/env'
import { SkyPlot, type SkyMarker } from './SkyPlot'
import type { PatternView3D } from '../three/PatternView3D'
import styles from './BeamLab.module.css'

type View = 'gain' | 'music' | '3d'

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: 'conventional', label: 'Conventional', hint: 'Delay-and-sum steered at the satellite. Fixed weights; no knowledge of the jammer.' },
  { id: 'mvdr', label: 'MVDR', hint: 'Minimise output power with unit gain toward the satellite. Nulls form automatically.' },
  { id: 'lcmv', label: 'LCMV', hint: 'Unit gain toward the satellite and explicit zeros at the MUSIC-estimated jammer directions.' },
]

/** Ideal-model nulls can reach −100 dB; real arrays cannot, so very deep values are clamped for display. */
const fmt = (db: number) => (db < -60 ? '< −60 dB' : `${db >= 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`)

function Slider({ label, value, min, max, step = 1, unit, onChange, display, disabled }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; display?: string; disabled?: boolean }) {
  const id = useId()
  return (
    <div className={styles.slider}>
      <label htmlFor={id}>
        <span>{label}</span>
        <output htmlFor={id}>{display ?? `${value}${unit}`}</output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function Group({ title, children, accent }: { title: string; children: ReactNode; accent?: 'sat' | 'jam' }) {
  return (
    <fieldset className={styles.group} data-accent={accent}>
      <legend>{title}</legend>
      {children}
    </fieldset>
  )
}

export function BeamLab() {
  const [params, setParams] = useState<LabParams>(DEFAULT_PARAMS)
  const [view, setView] = useState<View>('gain')
  const [preset, setPreset] = useState('single')
  const deferred = useDeferredValue(params)
  const result = useMemo(() => computeLab(deferred), [deferred])
  const webgl = useMemo(() => hasWebGL(), [])

  const set = (patch: Partial<LabParams>) => {
    setPreset('')
    setParams((p) => ({ ...p, ...patch }))
  }
  const setJam = (k: number, patch: Partial<LabParams['jammers'][number]>) => {
    setPreset('')
    setParams((p) => ({ ...p, jammers: p.jammers.map((j, i) => (i === k ? { ...j, ...patch } : j)) }))
  }

  const markers: SkyMarker[] = useMemo(() => {
    const m: SkyMarker[] = [{ id: 'sat', kind: 'sat', label: 'SAT', navAz: params.satAz, el: params.satEl }]
    params.jammers.forEach((j, i) => j.on && m.push({ id: `j${i}`, kind: 'jam', label: `J${i + 1}`, navAz: j.az, el: j.el }))
    if (view === 'music') result.estimates.forEach((e, i) => m.push({ id: `e${i}`, kind: 'est', label: 'est.', navAz: e.navAz, el: e.el }))
    return m
  }, [params, result.estimates, view])

  const onDrag = (id: string, az: number, el: number) => {
    if (id === 'sat') set({ satAz: az, satEl: Math.max(5, el) })
    else setJam(Number(id.slice(1)), { az, el: Math.min(60, el) })
  }

  const activeJams = params.jammers.map((j, i) => ({ ...j, i })).filter((j) => j.on)
  const halfLambda = params.spacing * L1_WAVELENGTH_M * 100
  const warnings: string[] = []
  if (params.spacing > 0.5) warnings.push('Spacing is above λ/2: grating lobes can appear — copies of the main beam in other directions.')
  for (const j of activeJams) {
    const sep = Math.hypot(((j.az - params.satAz + 540) % 360) - 180, j.el - params.satEl)
    if (sep < 15) warnings.push(`J${j.i + 1} is within ~15° of the satellite. The array cannot null it without also attenuating the satellite.`)
  }
  if (activeJams.length >= result.elements) warnings.push('More jammers than degrees of freedom (M − 1): not all can be nulled.')

  const gainLabel = `Sky map of array gain for ${METHODS.find((m) => m.id === params.method)!.label}. Satellite at azimuth ${params.satAz}°, elevation ${params.satEl}°: ${fmt(result.satDb)}. ${activeJams
    .map((j, k) => `Jammer ${j.i + 1} at ${j.az}°, ${j.el}°: ${fmt(result.jammerDb[k] ?? 0)}`)
    .join('. ')}.`
  const musicLabel = `MUSIC pseudo-spectrum. ${result.estimates.map((e, i) => `Estimate ${i + 1}: azimuth ${e.navAz.toFixed(0)}°, elevation ${e.el.toFixed(0)}°`).join('. ') || 'No jammers active.'}`

  return (
    <div className={styles.lab}>
      <div className={styles.presets} role="group" aria-label="Scenario presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.preset}
            aria-pressed={preset === p.id}
            onClick={() => {
              setPreset(p.id)
              setParams({ ...DEFAULT_PARAMS, ...p.params, seed: params.seed })
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            setPreset('single')
            setParams(DEFAULT_PARAMS)
            setView('gain')
          }}
        >
          Reset
        </button>
      </div>
      {preset ? <p className={styles.presetNote}>{PRESETS.find((p) => p.id === preset)?.description}</p> : null}

      <div className={styles.body}>
        <form className={styles.controls} onSubmit={(e) => e.preventDefault()} aria-label="Beamforming parameters">
          <Group title="Beamformer">
            <div className={styles.segment} role="radiogroup" aria-label="Beamforming method">
              {METHODS.map((m) => (
                <label key={m.id} className={styles.segOpt}>
                  <input type="radio" name="method" value={m.id} checked={params.method === m.id} onChange={() => set({ method: m.id })} />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <p className={styles.hint}>{METHODS.find((m) => m.id === params.method)!.hint}</p>
          </Group>

          <Group title="Array">
            <div className={styles.segment} role="radiogroup" aria-label="Array size">
              {([2, 3, 4] as const).map((n) => (
                <label key={n} className={styles.segOpt}>
                  <input type="radio" name="size" value={n} checked={params.size === n} onChange={() => set({ size: n })} />
                  <span>
                    {n}×{n}
                  </span>
                </label>
              ))}
            </div>
            <Slider label="Element spacing" value={params.spacing} min={0.3} max={1} step={0.05} unit="λ" display={`${params.spacing.toFixed(2)} λ · ${halfLambda.toFixed(1)} cm at L1`} onChange={(v) => set({ spacing: v })} />
          </Group>

          <Group title="Satellite (desired)" accent="sat">
            <Slider label="Azimuth" value={params.satAz} min={0} max={359} unit="°" onChange={(v) => set({ satAz: v })} />
            <Slider label="Elevation" value={params.satEl} min={5} max={90} unit="°" onChange={(v) => set({ satEl: v })} />
          </Group>

          {params.jammers.map((j, k) => (
            <Group key={k} title={`Jammer ${k + 1}`} accent="jam">
              {k > 0 ? (
                <label className={styles.toggle}>
                  <input type="checkbox" checked={j.on} onChange={(e) => setJam(k, { on: e.target.checked })} />
                  <span>Active</span>
                </label>
              ) : null}
              <div className={styles.jamFields} data-off={!j.on || undefined}>
                <Slider label="Azimuth" value={j.az} min={0} max={359} unit="°" disabled={!j.on} onChange={(v) => setJam(k, { az: v })} />
                <Slider label="Elevation" value={j.el} min={0} max={60} unit="°" disabled={!j.on} onChange={(v) => setJam(k, { el: v })} />
                <Slider label="Jammer-to-noise" value={j.jnr} min={0} max={60} unit=" dB" disabled={!j.on} onChange={(v) => setJam(k, { jnr: v })} />
              </div>
            </Group>
          ))}

          <Group title="Estimation">
            <label className={styles.select}>
              <span>Snapshots N</span>
              <select value={params.snapshots} onChange={(e) => set({ snapshots: Number(e.target.value) })}>
                {[16, 32, 64, 256, 1024].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.reseed} onClick={() => set({ seed: params.seed + 1 })}>
              New noise realisation
            </button>
          </Group>
        </form>

        <div className={styles.visual}>
          <div className={styles.views} role="tablist" aria-label="Visualisation">
            {(
              [
                ['gain', 'Array gain'],
                ['music', 'MUSIC DoA'],
                ...(webgl ? [['3d', '3D pattern']] : []),
              ] as [View, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} className={styles.viewTab} onClick={() => setView(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.stage} role="tabpanel">
            {view === '3d' ? (
              <Pattern3D gainDb={result.gainDb} markers={markers} />
            ) : (
              <SkyPlot
                map={view === 'gain' ? result.gainDb : result.musicDb}
                markers={markers}
                ariaLabel={view === 'gain' ? gainLabel : musicLabel}
                onDrag={onDrag}
                rangeDb={40}
              />
            )}
          </div>

          <dl className={styles.readouts} aria-live="polite">
            <div>
              <dt>Toward satellite</dt>
              <dd className={styles.sat}>{fmt(result.satDb)}</dd>
            </div>
            {activeJams.map((j, k) => (
              <div key={j.i}>
                <dt>Toward J{j.i + 1}</dt>
                <dd className={styles.jam}>{fmt(result.jammerDb[k] ?? 0)}</dd>
              </div>
            ))}
            <div>
              <dt>SINR · 1 element → array</dt>
              <dd>
                {fmt(result.sinrInDb)} → <strong>{fmt(result.sinrOutDb)}</strong>
              </dd>
            </div>
            <div>
              <dt>SINR improvement</dt>
              <dd className={styles.verified}>{fmt(result.sinrOutDb - result.sinrInDb)}</dd>
            </div>
            <div>
              <dt>Degrees of freedom</dt>
              <dd>
                M − 1 = {result.elements - 1}
              </dd>
            </div>
            {result.estimates.map((e, i) => (
              <div key={i}>
                <dt>MUSIC estimate {i + 1}</dt>
                <dd>
                  {e.navAz.toFixed(0)}° / {e.el.toFixed(0)}° {e.errorDeg !== null ? <small>(err {e.errorDeg.toFixed(1)}°)</small> : null}
                </dd>
              </div>
            ))}
          </dl>
          {warnings.length ? (
            <ul className={styles.warnings} role="list">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <details className={styles.assumptions}>
        <summary>Model & assumptions</summary>
        <div className={styles.assumptionsBody}>
          <p>
            Illustrative narrowband model, computed in your browser — <strong>not</strong> a validated RF simulation and not a model of any specific product.
          </p>
          <ul>
            <li>Uniform rectangular array in the horizontal plane; identical isotropic elements; no mutual coupling, calibration error or platform effects.</li>
            <li>Far-field plane waves at GPS L1 (1575.42 MHz, λ ≈ 19.0 cm); steering vector a(θ) = exp(j2π pₘ·u(θ)), positions in wavelengths.</li>
            <li>
              Satellite per-element SNR {SAT_SNR_DB} dB (GNSS arrives below the noise floor; the receiver’s despreading gain is not included). Jammers are Gaussian noise sources at the chosen JNR.
            </li>
            <li>Covariance is the sample covariance of N simulated snapshots (seeded, reproducible) with 10⁻⁴ diagonal loading.</li>
            <li>MVDR: w = R⁻¹a / (aᴴR⁻¹a). LCMV: w = R⁻¹C(CᴴR⁻¹C)⁻¹f, with constraints placed at the MUSIC estimates — so estimation errors propagate, as they would in practice.</li>
            <li>Gains are normalised to the pattern peak; SINR uses the true interference-plus-noise covariance.</li>
            <li>Responses below −60 dB are shown as “&lt; −60 dB”: an ideal model nulls far deeper than real hardware, where calibration, quantisation and bandwidth limit null depth.</li>
          </ul>
        </div>
      </details>
    </div>
  )
}

function Pattern3D({ gainDb, markers }: { gainDb: Float32Array; markers: SkyMarker[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<PatternView3D | null>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef({ gainDb, markers })

  useEffect(() => {
    latest.current = { gainDb, markers }
    viewRef.current?.update(gainDb, markers.filter((m) => m.kind !== 'est').map((m) => ({ kind: m.kind as 'sat' | 'jam', navAz: m.navAz, el: m.el })))
  }, [gainDb, markers])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let view: PatternView3D | null = null
    let cancelled = false
    import('../three/PatternView3D')
      .then(({ PatternView3D }) => {
        if (cancelled) return
        view = new PatternView3D(canvas, LAB_GRID)
        viewRef.current = view
        const { gainDb: g, markers: m } = latest.current
        view.update(g, m.filter((x) => x.kind !== 'est').map((x) => ({ kind: x.kind as 'sat' | 'jam', navAz: x.navAz, el: x.el })))
      })
      .catch(() => setFailed(true))
    const ro = new ResizeObserver(() => viewRef.current?.resize())
    ro.observe(canvas)
    return () => {
      cancelled = true
      ro.disconnect()
      view?.dispose()
      viewRef.current = null
    }
  }, [])

  if (failed) return <p className={styles.hint}>The 3D view could not start on this device. The sky map shows the same data.</p>
  return (
    <div className={styles.view3d}>
      <canvas ref={canvasRef} className={styles.canvas3d} tabIndex={0} aria-label="3D array pattern. Drag, or use the arrow keys, to rotate." data-cursor="Drag" />
      <p className={styles.hint}>Radius ∝ gain over a 40 dB range. Blue line: satellite; amber: jammers. Drag or use arrow keys to orbit.</p>
    </div>
  )
}
