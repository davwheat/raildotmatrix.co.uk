import { useCallback, useEffect, useState } from 'react'
import GetNextTrainsAtStationStaff, { StaffServicesResponse } from '../api/GetNextTrainsAtStationStaff'

interface Options {
  updateIntervalSecs: number
}

const DefaultOptions: Options = {
  updateIntervalSecs: 20,
}

interface DataInfo {
  loadingData: boolean
  lastUpdated: number
}

const RAILANNOUNCEMENTS_ORIGINS = ['https://railannouncements.co.uk', 'http://localhost:8000']

export function useServiceInformation(
  station: string,
  options: Options = DefaultOptions,
): [StaffServicesResponse | null | { error: true }, DataInfo] {
  const [receiveDataFromParentIframe, setReceiveDataFromParentIframe] = useState(false)

  const [trainData, setTrainData] = useState<StaffServicesResponse | null | { error: true }>(null)
  const [dataInfo, setDataInfo] = useState({
    loadingData: false,
    lastUpdated: 0,
  })

  options = { ...DefaultOptions, ...options }

  const loadData = useCallback(() => {
    loadTrainData(station, (data: StaffServicesResponse | null | { error: true }) => {
      setTrainData(data)
      setDataInfo({ lastUpdated: Date.now(), loadingData: false })
    })
  }, [station, setTrainData, setDataInfo])

  const onMessage = useCallback(
    (e: MessageEvent) => {
      if (!RAILANNOUNCEMENTS_ORIGINS.includes(e.origin) && e.origin !== window.location.origin) {
        console.error('Invalid iframe message origin:', e.origin)
        return
      }

      if ((e.data.source as string | undefined)?.startsWith('react-devtools-')) {
        return
      }

      if (!receiveDataFromParentIframe) {
        console.log('Received first train service info message. Disabling automatic data updates via API.')
        setReceiveDataFromParentIframe(true)
      }
      console.log('Received train service info from parent', e.data)
      setTrainData(e.data)
      setDataInfo({ lastUpdated: Date.now(), loadingData: false })
    },
    [setTrainData, setDataInfo, receiveDataFromParentIframe, setReceiveDataFromParentIframe],
  )

  useEffect(() => {
    window.addEventListener('message', onMessage)

    if (receiveDataFromParentIframe || dataInfo.loadingData)
      return () => {
        window.removeEventListener('message', onMessage)
      }

    if (dataInfo.lastUpdated === 0) {
      loadData()
    }

    const key = setInterval(() => {
      loadData()
    }, options.updateIntervalSecs * 1000)

    return () => {
      clearInterval(key)
      window.removeEventListener('message', onMessage)
    }
  }, [setTrainData, setDataInfo, dataInfo, station, loadTrainData, receiveDataFromParentIframe])

  return [trainData, dataInfo]
}

function loadTrainData(station: string, setTrainData: (data: any) => void) {
  const ac = new AbortController()

  GetNextTrainsAtStationStaff(station, { minOffset: 0 }, ac).then(data => {
    setTrainData(data)
  })

  return ac
}

export function isValidResponseApi(response: StaffServicesResponse | null | { error: true }): response is StaffServicesResponse {
  return response !== null && !(response as any).error && (response as any).trainServices
}
