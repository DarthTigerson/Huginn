import { useEffect, useRef } from 'react'

// Shared by GitGraphPage and GitBranchDiffPage: watches a sentinel element
// rendered after the last row, and calls onLoadMore once it scrolls near
// view. rootMargin fires the fetch ~200px before the sentinel is actually
// on-screen so the next page is usually ready before the user reaches it.
export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean, loading: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, loading])

  return sentinelRef
}
