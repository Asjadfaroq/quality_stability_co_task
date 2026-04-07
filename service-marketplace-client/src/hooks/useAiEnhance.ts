import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import api, { isRateLimited } from '../api/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiEnhanceResult {
  enhancedDescription: string
  suggestedCategory:   string
}

export interface UseAiEnhanceReturn {
  enhancing: boolean
  enhance:   (title: string, rawDescription: string) => Promise<AiEnhanceResult | null>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Encapsulates the AI description-enhancement API call.
 * Returns `null` on error (toast is shown internally; rate-limit toast is
 * handled by the axios interceptor so we only show a generic error otherwise).
 */
export function useAiEnhance(): UseAiEnhanceReturn {
  const [enhancing, setEnhancing] = useState(false)

  const enhance = useCallback(
    async (title: string, rawDescription: string): Promise<AiEnhanceResult | null> => {
      if (!rawDescription.trim()) return null

      setEnhancing(true)
      try {
        const { data } = await api.post<AiEnhanceResult>('/ai/enhance-description', {
          title,
          rawDescription,
        })
        return data
      } catch (err) {
        if (!isRateLimited(err)) toast.error('AI enhancement failed. Please try again.')
        return null
      } finally {
        setEnhancing(false)
      }
    },
    [],
  )

  return { enhancing, enhance }
}
