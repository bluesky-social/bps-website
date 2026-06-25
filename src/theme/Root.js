import React from 'react'
import Root from '@theme-original/Root'
import { AuthProvider } from '@site/src/auth/AuthContext'

export default function RootWrapper(props) {
  return (
    <AuthProvider>
      <Root {...props} />
    </AuthProvider>
  )
}
