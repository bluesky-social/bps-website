import React from 'react'
import Link from '@docusaurus/Link'
import styles from './styles.module.css'

// Grid of section-link cards for docs index pages. Each card carries a mono
// numbering tag (e.g. "01 · Post"), a title, and a one-line description.
export default function DocsCardGrid({ items = [] }) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Link key={item.to} to={item.to} className={`bpsDocCard ${styles.card}`}>
          {item.tag && <span className={styles.tag}>{item.tag}</span>}
          <h3 className={styles.title}>{item.title}</h3>
          {item.body && <p className={styles.body}>{item.body}</p>}
        </Link>
      ))}
    </div>
  )
}
