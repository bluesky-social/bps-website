import React, { useEffect } from 'react'
import { useLocation } from '@docusaurus/router'
import Root from '@theme-original/Root'
import { AuthProvider } from '@site/src/auth/AuthContext'

// Click-to-zoom for images inside rendered doc/blog content. Screenshots (e.g.
// the Coop dashboard captures) are barely legible inline; medium-zoom gives a
// full-size lightbox on click. Scoped to `.markdown img` so UI chrome, logos,
// and page-component images (homepage flags, account SPA, etc.) are untouched.
// Re-attaches on every navigation because Docusaurus swaps content client-side.
function ImageZoom() {
  const { pathname } = useLocation()

  useEffect(() => {
    let zoom
    let cancelled = false
    // Defer a frame so the new route's content is in the DOM before we scan.
    const raf = window.requestAnimationFrame(async () => {
      const mediumZoom = (await import('medium-zoom')).default
      if (cancelled) return
      zoom = mediumZoom('.markdown img', {
        background: 'rgba(0, 0, 0, 0.85)',
        margin: 24,
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      if (zoom) zoom.detach()
    }
  }, [pathname])

  return null
}

export default function RootWrapper(props) {
  return (
    <AuthProvider>
      <ImageZoom />
      <Root {...props} />
    </AuthProvider>
  )
}
