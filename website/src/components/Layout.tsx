import React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>
}
