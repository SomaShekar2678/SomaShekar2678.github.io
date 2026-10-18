/** Section order and navigation labels. Reorder here; components read from this list. */
export const sections = [
  { id: 'top', label: 'Intro', index: '00' },
  { id: 'about', label: 'About', index: '01' },
  { id: 'expertise', label: 'Expertise', index: '02' },
  { id: 'work', label: 'Work', index: '03' },
  { id: 'lab', label: 'Lab', index: '04' },
  { id: 'experience', label: 'Experience', index: '05' },
  { id: 'education', label: 'Education', index: '06' },
  { id: 'india', label: 'India', index: '07' },
  { id: 'contact', label: 'Contact', index: '08' },
] as const

export type SectionId = (typeof sections)[number]['id']

export function sectionMeta(id: SectionId) {
  const s = sections.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown section ${id}`)
  return s
}

export const india = {
  title: 'Building technology that advances India.',
  intro:
    'India is building its own satellite navigation, its own strategic electronics and its own autonomous systems. These are the problems I want to spend my career on — as engineering work: signal models, hardware, data and validation in the field.',
  disclaimer: 'These are interests and ambitions — the areas where I want to contribute. They are not affiliations or achievements.',
  areas: [
    {
      title: 'Indigenous navigation',
      body: 'Receivers and signal processing that make full use of NavIC alongside other constellations.',
      link: 'GNSS receiver research',
    },
    {
      title: 'Resilient PNT',
      body: 'Positioning, navigation and timing that keep working when satellites are degraded, combining GNSS with inertial and visual sources.',
      link: 'Visual localization · sensor fusion',
    },
    {
      title: 'Interference-resilient RF',
      body: 'Anti-jamming and spoofing detection built on adaptive arrays and real-time hardware.',
      link: 'J-DOME',
    },
    {
      title: 'Strategic electronics',
      body: 'Domestic capability in FPGA and RF signal-processing systems — designed, implemented and validated in India.',
      link: 'RFSoC / HLS work',
    },
    {
      title: 'Industrial diagnostics',
      body: 'Predictive maintenance that turns the telemetry Indian industry already collects into maintenance decisions with honest uncertainty.',
      link: 'Engine prognostics',
    },
    {
      title: 'Autonomous systems',
      body: 'Robotics and UAV autonomy that work in Indian conditions — terrain, weather and contested spectrum.',
      link: 'Perception & state estimation',
    },
    {
      title: 'Affordable engineering',
      body: 'Reliable systems built to a cost that Indian industry and institutions can actually deploy.',
      link: null,
    },
    {
      title: 'Knowledge transfer',
      body: 'Research, technology development and teaching that move capability from papers into practice.',
      link: null,
    },
  ],
  visualCaption:
    'Illustrative orbital geometry based on publicly documented NavIC slots: three geostationary satellites (32.5°E, 83°E, 129.5°E) and geosynchronous satellites in 29°-inclined orbits crossing the equator at 55°E and 111.75°E. Not a live ephemeris.',
} as const
