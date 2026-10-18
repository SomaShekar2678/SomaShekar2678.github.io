/**
 * "A signal's journey" — the scroll-driven 3D sequence between the hero and About.
 * Each stage maps to a world in src/components/three/JourneyScene.ts (same order).
 * Visuals are illustrative; the text avoids numbers that are not general physics.
 */
export interface JourneyStage {
  id: 'space' | 'interference' | 'array' | 'fpga' | 'perception' | 'fix'
  title: string
  body: string
  related?: { label: string; href: string }
}

export const journey = {
  title: 'A signal’s journey.',
  intro: 'Follow one satellite signal through the problems I work on — from orbit to a position you can trust.',
  note: 'Illustrative scenes, not to scale.',
  stages: [
    {
      id: 'space',
      title: 'Broadcast from orbit',
      body: 'A GNSS satellite about 20,000 km up transmits its signal. By the time it reaches the ground it is weaker than the background noise.',
    },
    {
      id: 'interference',
      title: 'Buried by interference',
      body: 'A nearby transmitter on the same band does not need much power to drown it out. On the spectrum, the jammer towers over a signal that was already below the floor.',
      related: { label: 'Interference classification', href: '#/work/j-dome' },
    },
    {
      id: 'array',
      title: 'The array adapts',
      body: 'A multi-antenna array estimates where the interference comes from and reshapes its pattern — a null toward the jammer, gain kept toward the sky.',
      related: { label: 'J-DOME', href: '#/work/j-dome' },
    },
    {
      id: 'fpga',
      title: 'In real-time hardware',
      body: 'On an FPGA, covariance and adaptive weights are recomputed continuously as samples stream through fixed-point pipelines.',
      related: { label: 'RFSoC implementation', href: '#/work/j-dome' },
    },
    {
      id: 'perception',
      title: 'When satellites are not enough',
      body: 'Cameras, LiDAR and inertial sensors keep the platform localised when GNSS is degraded — fused into one consistent estimate.',
      related: { label: 'Perception & state estimation', href: '#/work/perception-state-estimation' },
    },
    {
      id: 'fix',
      title: 'A position you can trust',
      body: 'Signals, hardware and intelligence end in one number that matters: where you are, and how sure you can be.',
      related: { label: 'See all work', href: '#work' },
    },
  ] satisfies JourneyStage[],
} as const
