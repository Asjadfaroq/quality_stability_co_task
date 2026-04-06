import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5132/api',
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    if (error.response?.status === 429) {
      const seconds = parseInt(error.response.headers['retry-after'] ?? '0', 10)
      const timeMsg = seconds > 0
        ? seconds >= 60
          ? `${Math.ceil(seconds / 60)} min`
          : `${seconds}s`
        : null
      toast.error(
        timeMsg ? `Too many requests. Try again in ${timeMsg}.` : 'Too many requests. Please try again later.',
        { id: 'rate-limit' }
      )
    }

    return Promise.reject(error)
  }
)

// Use this in onError handlers to avoid a double toast when the interceptor already handled 429
export function isRateLimited(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 429
}

export default api
