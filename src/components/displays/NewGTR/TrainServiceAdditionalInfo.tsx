import React, { useEffect } from 'react'

import SlideyScrollText from './SlideyScrollText'
import clsx from 'clsx'

import { AssociationCategory } from '../../../api-types/get-services-types'
import type { IAssociation, IMyTrainService } from '../../../api/ProcessServices'

interface IProps {
  service: IMyTrainService
}

function aAnToc(toc: string): string {
  switch (toc) {
    case 'Avanti West Coast':
    case 'Elizabeth Line':
    case 'East Midlands Railway':
    case 'Island Line':
      return 'An'

    default:
      return 'A'
  }
}

function combineNames(locations: IMyTrainService['origins']): string {
  const names = locations.map(location => location.name)
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function getServiceInfo(service: IMyTrainService): string {
  const { toc, length } = service

  const portions: string[] = []

  if (service.terminatesHere) {
    portions.push(`${toc} service. This is the service from ${combineNames(service.origins)}.`)
  } else {
    portions.push(`${aAnToc(toc)}${toc ? ` ${toc}` : ''} service${length ? ` formed of ${length} coaches` : ''}.`)
  }

  if (service.cancelled) {
    if (service.cancelReason) portions.push(service.cancelReason)
  } else if (service.isDelayed()) {
    if (service.delayReason) portions.push(service.delayReason)
  }

  return portions.join(' ')
}

interface InfoPage {
  prefix: string
  callPoints: string[]
}

function _TrainServiceAdditionalInfo({ service }: IProps) {
  const associatedServices = React.useMemo(
    () =>
      service.passengerCallPoints
        .map(s => s.associations)
        .flat(1)
        .filter((a): a is IAssociation<AssociationCategory.Divide> => a.type === AssociationCategory.Divide)
        .map(a => a.service),
    [JSON.stringify(service)],
  )

  // Memoise to prevent early animation end
  const callingPointPages: InfoPage[] = React.useMemo(() => {
    // A terminating service has nowhere left to call, so the service line is the whole story.
    if (service.terminatesHere) return []

    const ogServicePoints = service.passengerCallPoints.map(p => {
      const aTime = p.displayedArrivalTime()
      return `${p.name}${aTime ? ` (${aTime})` : ''}`
    })

    const assocCount = associatedServices.length

    const assocServices = associatedServices.map((s, i): InfoPage => {
      const [stop1, ...stops] = s.passengerCallPoints

      const ogServiceDivideIndex = service.passengerCallPoints.findIndex(p => p.name === stop1.name)
      const pointsToDivide = ogServicePoints.slice(0, ogServiceDivideIndex + 1)

      const pos = i + 1 === assocCount ? 'Rear' : 'Middle'

      return {
        prefix: `${pos} ${s.length ? `${s.length} ` : ''}coaches:`,
        callPoints: [
          ...pointsToDivide,
          ...stops.map(p => {
            const aTime = p.displayedArrivalTime()
            return `${p.name}${aTime ? ` (${aTime})` : ''}`
          }),
        ],
      }
    })

    if (assocServices.length === 0) {
      // No splits
      return [
        {
          prefix: 'Calling at:',
          callPoints: ogServicePoints,
        },
      ]
    } else {
      const ogLengthEnd = service.passengerCallPoints.at(-1)!!.length
      return [{ prefix: `Front ${ogLengthEnd ? `${ogLengthEnd} ` : ''}coaches:`, callPoints: ogServicePoints }, ...assocServices]
    }
  }, [service.terminatesHere, JSON.stringify(service.passengerCallPoints), JSON.stringify(associatedServices.map(a => a.passengerCallPoints))])

  const pageCount = 1 + callingPointPages.length

  const [shownPage, setShownPage] = React.useState(0)

  const nextPage = React.useCallback(() => {
    setShownPage(p => {
      if (p + 1 >= pageCount) return 0
      return p + 1
    })
  }, [pageCount])

  useEffect(() => {
    if (shownPage >= pageCount) setShownPage(0)
  }, [shownPage, pageCount])

  const serviceInfo = React.useMemo(() => getServiceInfo(service), [JSON.stringify(service)])

  console.log(callingPointPages)
  console.log(service)

  return (
    <div className="trainServiceAdditional">
      <div className={clsx('info', { shown: shownPage === 0 })}>
        <SlideyScrollText
          callCompleteIfNotScrolling={8_000}
          onComplete={() => {
            shownPage === 0 && nextPage()
            // Stop animation
            console.log('next from info')

            return true
          }}
        >
          {serviceInfo}
        </SlideyScrollText>
      </div>

      {callingPointPages.map((page, i) => (
        <CallingPointsPage
          key={i}
          page={page}
          shown={shownPage === i + 1}
          onComplete={() => {
            console.log('next from call p', i + 1)
            nextPage()
          }}
        />
      ))}
    </div>
  )
}

// The list's state lives here rather than in TrainServiceAdditionalInfo, whose re-renders hand CallingPoints a new
// onComplete and so restart its scroll.
function CallingPointsPage({ page, shown, onComplete }: { page: InfoPage; shown: boolean; onComplete: () => void }) {
  // Stays null until the list is measured. The CSS lets an unmeasured page rise, so a static page is below its row from
  // the frame it is selected, but plays the matching fade-out only for a page measured as static, never one not yet shown.
  const [listScrolls, setListScrolls] = React.useState<boolean | null>(null)
  // Only cleared when the page is next shown: clearing it on deselect would bring the prefix back for the page's fade-out.
  const [scrolledOff, setScrolledOff] = React.useState(false)
  // A static list fades out with its prefix, as the information page does, so it stays until the page's fade has ended.
  const [fadedOut, setFadedOut] = React.useState(false)

  const onStart = React.useCallback((willScroll: boolean) => {
    setListScrolls(willScroll)
    setScrolledOff(false)
    setFadedOut(false)
  }, [])
  const onScrolledOff = React.useCallback(() => setScrolledOff(true), [])

  // Held as last rendered while shown: new props during the fade-out would restart its SlideyScrollText.
  const list = React.useRef<React.ReactElement | null>(null)
  if (shown) {
    list.current = <CallingPoints pointsText={page.callPoints} onStart={onStart} onScrolledOff={onScrolledOff} onComplete={onComplete} />
  }

  return (
    <div
      className={clsx('callingPoints', { shown, scrolls: listScrolls === true, static: listScrolls === false, scrolledOff })}
      onAnimationEnd={() => !shown && setFadedOut(true)}
    >
      <div className="callingAt">{page.prefix}</div>
      {(shown || (listScrolls === false && !fadedOut)) && list.current}
    </div>
  )
}

function _CallingPoints({
  pointsText,
  onStart,
  onScrolledOff,
  onComplete,
}: {
  pointsText: string[]
  onStart?: (willScroll: boolean) => void
  onScrolledOff?: () => void
  onComplete?: () => void
}) {
  console.log('calling points rendered')
  return (
    <SlideyScrollText
      onStart={onStart}
      onScrolledOff={onScrolledOff}
      onComplete={() => {
        onComplete?.()

        // Stop animation
        return true
      }}
    >
      {pointsText.map((p, i) => (
        <span className="callingAtPoint" key={i}>
          {p}
        </span>
      ))}
    </SlideyScrollText>
  )
}

const TrainServiceAdditionalInfo = React.memo(_TrainServiceAdditionalInfo, (previous, next) => {
  return JSON.stringify(previous) === JSON.stringify(next)
})

export default TrainServiceAdditionalInfo

const CallingPoints = React.memo(_CallingPoints)
