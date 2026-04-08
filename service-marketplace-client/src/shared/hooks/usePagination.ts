import { useState, useCallback } from 'react'

interface UsePaginationReturn {
  page:            number
  pageSize:        number
  setPage:         (page: number) => void
  setPageSize:     (size: number) => void
  resetPage:       () => void
}

/**
 * Encapsulates the page / pageSize state pair that every paginated list page
 * needs.  Centralising it here ensures the "reset page to 1 when pageSize
 * changes" invariant is applied consistently everywhere.
 */
export function usePagination(defaultPageSize = 10): UsePaginationReturn {
  const [page,     setPageRaw]     = useState(1)
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize)

  const setPage     = useCallback((p: number) => setPageRaw(p), [])
  const resetPage   = useCallback(() => setPageRaw(1), [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size)
    setPageRaw(1)
  }, [])

  return { page, pageSize, setPage, setPageSize, resetPage }
}
