import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { SERVICE_CATEGORIES } from '../constants/categories'

export function useServiceCategories() {
  const query = useQuery<string[]>({
    queryKey: ['service-categories'],
    queryFn: () => api.get('/metadata/categories').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  return {
    ...query,
    categories: query.data ?? [...SERVICE_CATEGORIES],
  }
}
