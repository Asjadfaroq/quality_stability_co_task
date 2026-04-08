import { useState, useCallback } from 'react'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  loading: boolean
  error: string | null
}

export interface UseGeolocationReturn extends GeolocationState {
  detect: () => void
}

const GEO_ERROR_MESSAGES: Record<number, string> = {
  [GeolocationPositionError.PERMISSION_DENIED]:
    'Location access denied. Allow access or enter coordinates manually.',
  [GeolocationPositionError.POSITION_UNAVAILABLE]:
    'Location unavailable. Try entering coordinates manually.',
  [GeolocationPositionError.TIMEOUT]:
    'Location request timed out. Try again.',
}

const INITIAL_STATE: GeolocationState = {
  latitude: null,
  longitude: null,
  loading: false,
  error: null,
}

export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>(INITIAL_STATE)

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ ...INITIAL_STATE, error: 'Geolocation is not supported by your browser.' })
      return
    }

    setState({ ...INITIAL_STATE, loading: true })

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setState({
          latitude: parseFloat(coords.latitude.toFixed(6)),
          longitude: parseFloat(coords.longitude.toFixed(6)),
          loading: false,
          error: null,
        })
      },
      (err) => {
        setState({
          ...INITIAL_STATE,
          error: GEO_ERROR_MESSAGES[err.code] ?? 'Failed to detect location.',
        })
      },
      { timeout: 10_000, maximumAge: 300_000, enableHighAccuracy: false },
    )
  }, [])

  return { ...state, detect }
}
