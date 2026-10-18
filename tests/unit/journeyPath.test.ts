import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES, journeyAt } from '../../src/lib/journeyPath'
import { journey } from '../../src/content/journey'

describe('journey path', () => {
  it('has one caption per scene stage', () => {
    expect(journey.stages).toHaveLength(JOURNEY_STAGES)
  })

  it('starts at the first stage and ends at the last', () => {
    expect(journeyAt(0)).toMatchObject({ index: 0, active: 0, travel: 0 })
    expect(journeyAt(1)).toMatchObject({ index: JOURNEY_STAGES - 1, active: JOURNEY_STAGES - 1, travel: 0 })
  })

  it('clamps out-of-range progress', () => {
    expect(journeyAt(-2).index).toBe(0)
    expect(journeyAt(7).index).toBe(JOURNEY_STAGES - 1)
  })

  it('dwells before travelling, and travel is continuous across slices', () => {
    const slice = 1 / JOURNEY_STAGES
    expect(journeyAt(slice * 0.3).travel).toBe(0)
    expect(journeyAt(slice * 0.999).travel).toBeGreaterThan(0.99)
    // Just after the boundary we are dwelling at the next stage: same camera position.
    expect(journeyAt(slice * 1.001)).toMatchObject({ index: 1, travel: 0 })
  })

  it('visits every stage in order as progress increases', () => {
    let last = 0
    const seen = new Set<number>()
    for (let p = 0; p <= 1; p += 0.002) {
      const { active } = journeyAt(p)
      expect(active).toBeGreaterThanOrEqual(last)
      last = active
      seen.add(active)
    }
    expect(seen.size).toBe(JOURNEY_STAGES)
  })
})
