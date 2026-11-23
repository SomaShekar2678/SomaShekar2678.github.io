import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES, JOURNEY_HEIGHT_SVH, journeyProgress, journeyAt } from '../../src/lib/journeyPath'
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
    const slice = journeyProgress(1, 0)
    expect(journeyAt(slice * 0.3).travel).toBe(0)
    expect(journeyAt(slice * 0.999).travel).toBeGreaterThan(0.99)
    // Just after the boundary we are dwelling at the next stage: same camera position.
    expect(journeyAt(slice * 1.001)).toMatchObject({ index: 1, travel: 0 })
  })

  it('gives Scene02 longer holds and a slower exit without speeding up other scenes', () => {
    const distance = (i: number, a: number, b: number) => (journeyProgress(i,b)-journeyProgress(i,a))*(JOURNEY_HEIGHT_SVH-100)
    expect(distance(1,0,.58)).toBeCloseTo(560/6*4*.8)
    expect(distance(1,.58,1)).toBeCloseTo(560/6*4*.2)
    for (const i of [0,2,3,4,5]) expect(distance(i,0,1)).toBeCloseTo(560/6)
    expect(distance(1,.54,.58)).toBeGreaterThan(20) // final array gets a readable hold before flight
  })

  it('round-trips phase coordinates and stays continuous at both Scene02 boundaries', () => {
    for(let i=0;i<JOURNEY_STAGES;i++)for(const local of [0,.06,.19,.31,.47,.56,.58,.72,.999]){
      const result=journeyAt(journeyProgress(i,local))
      expect(result.index).toBe(i)
      expect(result.local).toBeCloseTo(local)
    }
    const end=journeyProgress(1,1)
    expect(journeyAt(end-1e-7).travel).toBeGreaterThan(.999)
    expect(journeyAt(end+1e-7)).toMatchObject({index:2,travel:0})
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
