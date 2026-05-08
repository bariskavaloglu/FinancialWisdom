import { useState, useEffect, useCallback, useRef } from 'react'

interface UseApiState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  isStale: boolean
}

interface UseApiOptions {
  immediate?: boolean  // fetch on mount (default: true)
}

/**
 * Generic hook for API calls with loading/error/stale state.
 * 
 * Usage:
 *   const { data, isLoading, error, refetch } = useApi(() => portfolioService.getLatest())
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  depsOrOptions: unknown[] | UseApiOptions = [],
  options: UseApiOptions = {}
) {
  // Geriye dönük uyumluluk: ikinci parametre options objesi mi yoksa deps array mi?
  const isOptions = !Array.isArray(depsOrOptions) && typeof depsOrOptions === 'object'
  const deps    = isOptions ? [] : (depsOrOptions as unknown[])
  const opts    = isOptions ? (depsOrOptions as UseApiOptions) : options
  const { immediate = true } = opts

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
    isStale: false,
  })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const result = await fetcherRef.current()
      setState({ data: result, isLoading: false, error: null, isStale: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setState((prev) => ({ ...prev, isLoading: false, error: msg }))
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (immediate) fetch()
  }, [immediate, fetch, ...deps])

  return { ...state, refetch: fetch }
}

/**
 * Hook for mutations (POST, PUT, DELETE).
 * 
 * Usage:
 *   const { mutate, isLoading, error } = useMutation(
 *     (data) => authService.login(data),
 *     { onSuccess: (result) => navigate('/dashboard') }
 *   )
 */
export function useMutation<TInput, TOutput>(
  mutator: (input: TInput) => Promise<TOutput>,
  callbacks?: {
    onSuccess?: (data: TOutput) => void
    onError?: (error: string) => void
  }
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async (input: TInput) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await mutator(input)
        callbacks?.onSuccess?.(result)
        return result
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
        setError(msg)
        callbacks?.onError?.(msg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return { mutate, isLoading, error }
}
