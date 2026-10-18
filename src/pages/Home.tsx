import { useEffect } from 'react'
import { Hero } from '../sections/Hero'
import { About } from '../sections/About'
import { Expertise } from '../sections/Expertise'
import { Work } from '../sections/Work'
import { LabSection } from '../sections/LabSection'
import { ExperienceSection } from '../sections/Experience'
import { Education } from '../sections/Education'
import { India } from '../sections/India'
import { Contact } from '../sections/Contact'

export const HOME_TITLE = 'Somashekar Reddy Nakka — AI/ML Engineer · Signal Processing · Autonomous Systems'

export function Home() {
  useEffect(() => {
    document.title = HOME_TITLE
  }, [])
  return (
    <>
      <Hero />
      <About />
      <Expertise />
      <Work />
      <LabSection />
      <ExperienceSection />
      <Education />
      <India />
      <Contact />
    </>
  )
}
