import React from 'react'
import styles from './styles.module.css'

// Light-native docs index hero: soft blue tint wash that fades before the
// page content, with ghosted topo lines echoing the homepage. Inverts to a
// deep blue-charcoal in dark mode. Presentational only.
export default function DocsHero({ eyebrow, title, children }) {
  return (
    <header className={styles.hero}>
      <div className={styles.wash} aria-hidden="true" />
      <svg
        className={styles.topo}
        viewBox="0 0 300 200"
        preserveAspectRatio="xMaxYMid slice"
        aria-hidden="true"
      >
        <path d="M300,10 C236,24 210,62 202,108 C195,150 156,162 128,200" />
        <path d="M300,52 C248,64 224,96 215,140 C208,184 176,196 150,200" />
        <path d="M300,96 C262,104 244,132 236,172 C230,196 208,200 188,200" />
      </svg>
      {eyebrow && <div className={styles.eyebrow}>{`// ${eyebrow}`}</div>}
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.lede}>{children}</p>}
    </header>
  )
}
