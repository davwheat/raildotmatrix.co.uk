import type React from 'react'

// Declared before '*.svg' because TypeScript resolves a tie between two equally specific wildcard patterns in
// favour of the first one.
declare module '*.inline.svg' {
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default ReactComponent
}

// Every other SVG is emitted as a file and imported by URL.
declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.scss'
declare module '*.css'

// Add to window object
declare global {
  interface Window {}
}
