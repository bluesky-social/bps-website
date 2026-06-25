/**
 * /account — Bluesky Protocol Services account management page.
 *
 * Client-only: the entire interactive subtree is wrapped in <BrowserOnly> so
 * nothing that touches browser APIs (useAuth, cookies, localStorage) ever runs
 * during Docusaurus's SSR/build pass. The fallback is a static loading shell
 * that renders identically in both the SSR pass and during hydration, so there
 * is no mismatch warning.
 *
 * AccountApp is require()'d inside the BrowserOnly render function so that the
 * module — and its useAuth() call — is never evaluated on the server.
 */

import React from 'react'
import Layout from '@theme/Layout'
import BrowserOnly from '@docusaurus/BrowserOnly'
import styles from './account.module.css'

function LoadingFallback() {
  return (
    <div className={styles.fallbackWrap}>
      <div className={styles.fallbackInner}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonLines}>
          <div className={styles.skeletonLine} style={{ width: '40%' }} />
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Layout
      title="Account"
      description="Manage your Bluesky Protocol Services account"
    >
      <BrowserOnly fallback={<LoadingFallback />}>
        {() => {
          const AccountApp =
            require('@site/src/components/Account/AccountApp').default
          return <AccountApp />
        }}
      </BrowserOnly>
    </Layout>
  )
}
