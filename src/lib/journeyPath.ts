/**
 * Maps scroll progress (0..1 through the journey section) to a stage.
 * Each stage gets an equal slice of scroll: the camera dwells for the first part of the slice,
 * then travels to the next world. The final stage only dwells.
 */
export const JOURNEY_STAGES = 6
/** Fraction of each slice spent dwelling before travelling on. */
export const DWELL = 0.58

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
  const x = Math.min(1, Math.max(0, progress)) * stages
  const index = Math.min(Math.floor(x), stages - 1)
  const local = Math.min(1, x - index)
  const travel = index < stages - 1 ? smoothstep(DWELL, 1, local) : 0
  return { index, local, travel, active: travel > 0.5 ? index + 1 : index }
}
