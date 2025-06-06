import React from 'react'
import { getCallingPoints } from './CallingPoints'

import '../css/stoppingDiagram.less'

export default function StoppingDiagramBigScreen() {
  const callingPoints = getCallingPoints('names')

  const truncCallingPoints = callingPoints.slice(0, 3)

  if (callingPoints.length >= 4) truncCallingPoints.push(callingPoints[callingPoints.length - 1])

  const isTruncated = callingPoints.length > 4

  // TODO: Add Class 700 clipart above first line

  return (
    <div className="stoppingDiagram">
      {truncCallingPoints.map((stn, i) => {
        return (
          <>
            <div className="stopLine" data-dotted={i === 3 && isTruncated} />
            <div className="stopText" style={{ '--stop-num': i + 1 } as any} data-pos={i % 2 ? 'bottom' : 'top'}>
              <span className="textWrapper">
                <span className="text t900">{stn}</span>
              </span>
            </div>
            <div className="stopCircle" style={{ '--stop-num': i + 1 } as any} data-next={i === 0}>
              {i === 0 && <span className="text t900">NEXT</span>}
            </div>
          </>
        )
      })}
    </div>
  )
}
