import { caCode } from './gnss'

/** Synthetic complex-baseband experiment. No RF front end, PLL/DLL, AGC or measured data. */
export const INTERFERENCE_MODEL = { carrierMHz: 1575.42, chipRateMHz: 1.023, samplesPerChip: 8, integrationMs: 1, maxJsrDb: 45 } as const
export type InterferenceKind = 'cw' | 'broadband' | 'sweep'
export function sinc(x: number) { return Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI*x)/(Math.PI*x) }
/** Analytic PSD illustration, relative to the thermal floor; Gaussian line width is display resolution. */
export function spectrumPower(offsetMHz: number, history: number, strength: number, kind: InterferenceKind) {
  const desired = .06 * sinc(offsetMHz / INTERFERENCE_MODEL.chipRateMHz) ** 2
  const center = kind === 'sweep' ? -1.5 + 3 * history : .65
  const jam = kind === 'broadband' ? 10 : 120 * Math.exp(-(((offsetMHz-center)/.055)**2))
  return { desired, total: 1 + desired + Math.max(0,strength) * jam }
}

/** Correlate one PRN1 period with a local replica. Precompute complex signal/noise projections;
 * adding a jammer then remains linear and cheap. Unit-amplitude desired signal, N/S=10 dB,
 * seeded circular complex Gaussian interference, 8 samples/chip, zero Doppler, no data bit change.
 * Plots use magnitude divided by the largest clean magnitude. No tracking-lock inference. */
export function correlationExperiment() {
  const chips = caCode(1), spc = INTERFERENCE_MODEL.samplesPerChip, n = chips.length * spc
  let seed = 0x137bad
  const rand = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return (seed+.5)/4294967296 }
  const gaussian = () => Math.sqrt(-2*Math.log(rand())) * Math.cos(2*Math.PI*rand()) / Math.SQRT2
  const nr = new Float64Array(n), ni = new Float64Array(n), jr = new Float64Array(n), ji = new Float64Array(n)
  for(let i=0;i<n;i++){nr[i]=gaussian()*Math.sqrt(10);ni[i]=gaussian()*Math.sqrt(10);jr[i]=gaussian();ji[i]=gaussian()}
  const lags = Array.from({length:65},(_,i)=>(i-32)/spc)
  const projections = lags.map(lag=>{
    let re=0,im=0,jre=0,jim=0
    for(let i=0;i<n;i++) {
      const c=1-2*chips[Math.floor(i/spc)]!
      const replica=1-2*chips[Math.floor(((i+lag*spc+n)%n)/spc)]!
      re+=(c+nr[i]!)*replica;im+=ni[i]!*replica;jre+=jr[i]!*replica;jim+=ji[i]!*replica
    }
    return [re/n,im/n,jre/n,jim/n] as const
  })
  const norm=Math.max(...projections.map(([re,im])=>Math.hypot(re,im)))
  const response=(powerRatio:number)=>projections.map(([re,im,jre,jim])=>Math.hypot(re+Math.sqrt(Math.max(0,powerRatio))*jre,im+Math.sqrt(Math.max(0,powerRatio))*jim)/norm)
  return { lags, response, clean:response(0) }
}
