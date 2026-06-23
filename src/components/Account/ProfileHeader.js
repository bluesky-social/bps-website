/**
 * ProfileHeader — shows avatar, displayName (or handle), and @handle.
 *
 * Consumes useAuth().profile. Renders an avatar image (with a graceful
 * monogram fallback when the image is absent or fails to load), the display
 * name, and the handle.
 *
 * Sits at the top of the authed AccountApp view.
 */

import React, { useState } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
import styles from './ProfileHeader.module.css'

/** First character monogram for the avatar fallback. */
function monogram(handle) {
  if (!handle) return '?'
  const h = handle.startsWith('@') ? handle.slice(1) : handle
  return h.charAt(0).toUpperCase()
}

function Avatar({ src, handle }) {
  const [imgErr, setImgErr] = useState(false)
  const mono = monogram(handle)

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={handle ? `@${handle}` : 'Account avatar'}
        className={styles.avatarImg}
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <span
      className={styles.avatarFallback}
      role="img"
      aria-label={handle ? `@${handle}` : 'Account avatar'}
    >
      {mono}
    </span>
  )
}

export default function ProfileHeader() {
  const { profile } = useAuth()

  const rawHandle = profile?.handle ?? ''
  const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle
  const displayName = profile?.displayName || null
  const avatar = profile?.avatar || null

  return (
    <header className={styles.header}>
      <div className={styles.avatarWrap}>
        <Avatar src={avatar} handle={handle} />
      </div>

      <div className={styles.identity}>
        <span className={styles.displayName}>
          {displayName || (handle ? `@${handle}` : 'Unknown')}
        </span>
        {displayName && handle && (
          <span className={styles.handle}>@{handle}</span>
        )}
      </div>
    </header>
  )
}
