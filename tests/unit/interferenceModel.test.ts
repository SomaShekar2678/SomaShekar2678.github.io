import { describe, it, expect } from 'vitest'
import { correlationExperiment, spectrumPower, INTERFERENCE_MODEL } from '../../src/lib/interferenceModel'

describe('Scene02 synthetic signal model',()=>{
  it('keeps carrier, code rate and integration distinct',()=>{
    expect(INTERFERENCE_MODEL.carrierMHz).toBe(1575.42)
    expect(1023 / (INTERFERENCE_MODEL.chipRateMHz*1000)).toBeCloseTo(INTERFERENCE_MODEL.integrationMs)
  })
  it('places the BPSK envelope null at one chip-rate offset',()=>{
    expect(spectrumPower(0,0,0,'cw').desired).toBeCloseTo(.06)
    expect(spectrumPower(1.023,0,0,'cw').desired).toBeLessThan(1e-20)
  })
  it('distinguishes a CW line, broadband floor, and a moving sweep',()=>{
    expect(spectrumPower(.65,.2,1,'cw').total).toBeGreaterThan(100)
    expect(spectrumPower(-.65,.2,1,'cw').total).toBeLessThan(2)
    const a=spectrumPower(-1,.2,1,'broadband'),b=spectrumPower(1,.2,1,'broadband')
    expect(a.total-a.desired).toBeCloseTo(b.total-b.desired)
    expect(spectrumPower(-.9,.2,1,'sweep').total).toBeGreaterThan(100)
    expect(spectrumPower(-.9,.8,1,'sweep').total).toBeLessThan(2)
  })
  it('finds PRN1 at zero delay without interference',()=>{
    const {clean,lags,response}=correlationExperiment()
    expect(lags[clean.indexOf(Math.max(...clean))]).toBe(0)
    expect(response(0)).toEqual(clean)
    expect(clean[32]).toBeCloseTo(1)
  })
  it('raises the off-peak correlation floor with strong broadband interference',()=>{
    const {clean,lags,response}=correlationExperiment()
    const average=(v:number[])=>v.filter((_,i)=>Math.abs(lags[i]!)>1.5).reduce((a,b)=>a+b*b,0)
    const jammed=response(10**(45/10))
    expect(average(jammed)).toBeGreaterThan(average(clean)*100)
    expect(jammed.every(Number.isFinite)).toBe(true)
    expect(correlationExperiment().response(100)).toEqual(response(100))
  })
})
