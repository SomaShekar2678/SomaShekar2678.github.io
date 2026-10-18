/**
 * GPS L1 C/A code generation (IS-GPS-200): two 10-stage LFSRs,
 * G1 = 1 + x³ + x¹⁰ and G2 = 1 + x² + x³ + x⁶ + x⁸ + x⁹ + x¹⁰, with a per-PRN G2 phase selector.
 */
const G2_TAPS: Record<number, [number, number]> = {
  1: [2, 6], 2: [3, 7], 3: [4, 8], 4: [5, 9], 5: [1, 9], 6: [2, 10], 7: [1, 8], 8: [2, 9],
  9: [3, 10], 10: [2, 3], 11: [3, 4], 12: [5, 6], 13: [6, 7], 14: [7, 8], 15: [8, 9], 16: [9, 10],
  17: [1, 4], 18: [2, 5], 19: [3, 6], 20: [4, 7], 21: [5, 8], 22: [6, 9], 23: [1, 3], 24: [4, 6],
  25: [5, 7], 26: [6, 8], 27: [7, 9], 28: [8, 10], 29: [1, 6], 30: [2, 7], 31: [3, 8], 32: [4, 9],
}

export const CA_LENGTH = 1023

/** Returns the 1023-chip C/A code for a PRN as 0/1 values. */
export function caCode(prn: number): Uint8Array {
  const taps = G2_TAPS[prn]
  if (!taps) throw new Error(`Unsupported PRN ${prn}`)
  const g1 = new Uint8Array(10).fill(1)
  const g2 = new Uint8Array(10).fill(1)
  const out = new Uint8Array(CA_LENGTH)
  for (let i = 0; i < CA_LENGTH; i++) {
    out[i] = g1[9]! ^ g2[taps[0] - 1]! ^ g2[taps[1] - 1]!
    const f1 = g1[2]! ^ g1[9]!
    const f2 = g2[1]! ^ g2[2]! ^ g2[5]! ^ g2[7]! ^ g2[8]! ^ g2[9]!
    g1.copyWithin(1, 0, 9)
    g2.copyWithin(1, 0, 9)
    g1[0] = f1
    g2[0] = f2
  }
  return out
}

/** Circular correlation of two ±1 sequences derived from 0/1 chips. */
export function circularCorrelation(a: Uint8Array, b: Uint8Array): Int32Array {
  const n = a.length
  const out = new Int32Array(n)
  for (let lag = 0; lag < n; lag++) {
    let s = 0
    for (let i = 0; i < n; i++) s += (1 - 2 * a[i]!) * (1 - 2 * b[(i + lag) % n]!)
    out[lag] = s
  }
  return out
}
