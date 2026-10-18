import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { expertise, MATURITY_META } from '../content/expertise'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { MaturityTag } from '../components/layout/Badges'
import { DomainGlyph } from '../components/visualizations/DomainGlyph'
import type { Maturity } from '../types/content'
import styles from './Expertise.module.css'

const LEVELS: Maturity[] = ['deployed', 'implemented', 'simulated', 'studied']

export function Expertise() {
  const meta = sectionMeta('expertise')
  const [activeId, setActiveId] = useState(expertise[0]!.id)
  const [filter, setFilter] = useState<Maturity | 'all'>('all')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const active = expertise.find((d) => d.id === activeId)!
  const select = (id: string) => {
    setActiveId(id)
    setFilter('all')
  }

  const items = useMemo(
    () =>
      active.items
        .filter((i) => filter === 'all' || i.maturity === filter)
        .sort((a, b) => MATURITY_META[b.maturity].rank - MATURITY_META[a.maturity].rank),
    [active, filter],
  )

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = expertise.length
    let next = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % n
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    if (next < 0) return
    e.preventDefault()
    select(expertise[next]!.id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section id="expertise" className="section" aria-labelledby="expertise-title">
      <div className="container">
        <SectionHead
          index={meta.index}
          label={meta.label}
          id="expertise-title"
          title="Six disciplines, one signal chain."
          aside={
            <>
              Each method is tagged by how far I have actually taken it — from <em>studied</em> to <em>deployed</em>. No percentages, no self-ratings.
            </>
          }
        />

        <div className={styles.layout}>
          <div className={styles.tabs} role="tablist" aria-label="Expertise domains" aria-orientation="vertical">
            {expertise.map((d, i) => (
              <button
                key={d.id}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                role="tab"
                id={`tab-${d.id}`}
                aria-selected={d.id === activeId}
                aria-controls={`panel-${d.id}`}
                tabIndex={d.id === activeId ? 0 : -1}
                className={styles.tab}
                onClick={() => select(d.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className={styles.tabIndex}>{d.index}</span>
                <span className={styles.tabTitle}>{d.title}</span>
                <span className={styles.tabCount} aria-label={`${d.items.length} methods`}>
                  {d.items.length}
                </span>
              </button>
            ))}
          </div>

          <div key={active.id} id={`panel-${active.id}`} role="tabpanel" aria-labelledby={`tab-${active.id}`} className={styles.panel} tabIndex={0}>
            <div className={styles.panelHead}>
              <div className={styles.glyph}>
                <DomainGlyph kind={active.glyph} />
              </div>
              <div className={styles.panelIntro}>
                <p className="label">
                  {active.index} — {active.short}
                </p>
                <h3 className={styles.panelTitle}>{active.title}</h3>
                <p className={styles.summary}>{active.summary}</p>
              </div>
            </div>

            <fieldset className={styles.filter}>
              <legend className="sr-only">Filter methods by maturity</legend>
              {(['all', ...LEVELS] as const).map((lvl) => {
                const count = lvl === 'all' ? active.items.length : active.items.filter((i) => i.maturity === lvl).length
                return (
                  <label key={lvl} className={styles.chip} data-disabled={count === 0 || undefined}>
                    <input type="radio" name="maturity" value={lvl} checked={filter === lvl} disabled={count === 0} onChange={() => setFilter(lvl)} />
                    <span>
                      {lvl === 'all' ? 'All' : MATURITY_META[lvl].label} <small>{count}</small>
                    </span>
                  </label>
                )
              })}
            </fieldset>

            <ul className={styles.items} role="list">
              {items.map((item) => (
                <li key={item.name} className={styles.item}>
                  <div>
                    <p className={styles.itemName}>{item.name}</p>
                    <p className={styles.itemContext}>{item.context}</p>
                  </div>
                  <MaturityTag maturity={item.maturity} />
                </li>
              ))}
              {items.length === 0 ? <li className={styles.empty}>No methods at this level in this domain.</li> : null}
            </ul>
          </div>
        </div>

        <dl className={styles.legend}>
          {LEVELS.map((l) => (
            <div key={l}>
              <dt>
                <MaturityTag maturity={l} />
              </dt>
              <dd>{MATURITY_META[l].description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
