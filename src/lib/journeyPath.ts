/**
 * Maps scroll progress (0..1 through the journey section) to a stage.
 * Scene 02 gets 2.5 scroll units for its five chapters; other scenes retain one.
 * Local coordinates stay compatible with the existing visual/camera choreography.
 */
export const JOURNEY_STAGES = 6
/** Fraction of each slice spent dwelling before travelling on. */
export const DWELL = 0.58
export const INTERFERENCE_DWELL = 0.72
export const SCENE_SCROLL_WEIGHTS = [1, 2.5, 1, 1, 1, 1] as const
export const JOURNEY_SCROLL_UNITS = SCENE_SCROLL_WEIGHTS.reduce((sum, weight) => sum + weight, 0)
// Original travel span: 560svh across six units. Keep that distance for every ordinary scene.
export const JOURNEY_HEIGHT_SVH = 100 + (560 / JOURNEY_STAGES) * JOURNEY_SCROLL_UNITS

/** Convert the existing scene-local coordinate to full-journey progress (also used by QA). */
export function journeyProgress(index: number, local: number) {
  const i = Math.max(0, Math.min(JOURNEY_STAGES - 1, index))
  const l = Math.max(0, Math.min(1, local))
  const raw = i !== 1 ? l : l <= DWELL
    ? l / DWELL * INTERFERENCE_DWELL
    : INTERFERENCE_DWELL + (l - DWELL) / (1 - DWELL) * (1 - INTERFERENCE_DWELL)
  return (SCENE_SCROLL_WEIGHTS.slice(0, i).reduce((sum, w) => sum + w, 0) + raw * SCENE_SCROLL_WEIGHTS[i]!) / JOURNEY_SCROLL_UNITS
}

export interface JourneyPosition {
  /** Stage whose slice we are in. */
  index: number
  /** 0..1 progress through that slice. */
  local: number
  /** 0..1 progress of the flight from `index` to `index + 1` (0 while dwelling). */
  travel: number
  /** Stage whose caption should show (switches halfway through a flight). */
  active: number
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function journeyAt(progress: number, stages = JOURNEY_STAGES): JourneyPosition {
  const p = Math.min(1, Math.max(0, progress))
  let index: number, local: number
  if (stages === JOURNEY_STAGES) {
    let remaining = p * JOURNEY_SCROLL_UNITS
    index = 0
    while (index < stages - 1 && remaining >= SCENE_SCROLL_WEIGHTS[index]!) {
      remaining -= SCENE_SCROLL_WEIGHTS[index++]!
    }
    const raw = Math.min(1, remaining / SCENE_SCROLL_WEIGHTS[index]!)
    local = index !== 1 ? raw : raw <= INTERFERENCE_DWELL
      ? raw / INTERFERENCE_DWELL * DWELL
      : DWELL + (raw - INTERFERENCE_DWELL) / (1 - INTERFERENCE_DWELL) * (1 - DWELL)
  } else {
    const x = p * stages
    index = Math.min(Math.floor(x), stages - 1)
    local = Math.min(1, x - index)
  }
  const travel = index < stages - 1 ? smoothstep(DWELL, 1, local) : 0
  return { index, local, travel, active: travel > 0.5 ? index + 1 : index }
}
