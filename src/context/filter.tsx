import { createSignal } from "solid-js"
import { createSimpleContext } from "./helper"

export const { use: useFilter, provider: FilterProvider } = createSimpleContext({
  name: "Filter",
  init: () => {
    const [searchQuery, setSearchQuery] = createSignal("")
    const [selectedServices, setSelectedServices] = createSignal<Set<string>>(new Set())
    const [showServiceFilter, setShowServiceFilter] = createSignal(false)
    const [showSearch, setShowSearch] = createSignal(false)
    const [minSpans, setMinSpans] = createSignal(0)
    const [errorOnly, setErrorOnly] = createSignal<boolean>(false)
    const [minDurationMs, setMinDurationMs] = createSignal<number>(0)
    const [sortKey, setSortKey] = createSignal<string>("time")

    const MIN_SPANS_THRESHOLDS = [0, 3, 5, 10, 20, 50]
    const MIN_DURATION_THRESHOLDS = [0, 10, 50, 100, 500, 1000, 5000]
    const SORT_KEYS = ["time", "duration", "spans", "errors"]

    return {
      get searchQuery() {
        return searchQuery()
      },
      get selectedServices() {
        return selectedServices()
      },
      get showServiceFilter() {
        return showServiceFilter()
      },
      get showSearch() {
        return showSearch()
      },
      get minSpans() {
        return minSpans()
      },
      get errorOnly() {
        return errorOnly()
      },
      get minDurationMs() {
        return minDurationMs()
      },
      get sortKey() {
        return sortKey()
      },

      setSearchQuery(q: string) {
        setSearchQuery(q)
      },
      toggleService(service: string) {
        setSelectedServices((prev) => {
          const next = new Set(prev)
          if (next.has(service)) {
            next.delete(service)
          } else {
            next.add(service)
          }
          return next
        })
      },
      clearServices() {
        setSelectedServices(new Set<string>())
      },
      toggleServiceFilter() {
        setShowServiceFilter((v) => !v)
      },
      closeServiceFilter() {
        setShowServiceFilter(false)
      },
      openSearch() {
        setShowSearch(true)
      },
      hideSearch() {
        setShowSearch(false)
      },
      clearSearch() {
        setShowSearch(false)
        setSearchQuery("")
      },
      toggleErrorOnly() {
        setErrorOnly(v => !v)
      },
      cycleMinDuration() {
        const cur = minDurationMs()
        const idx = MIN_DURATION_THRESHOLDS.indexOf(cur)
        const next = MIN_DURATION_THRESHOLDS[(idx + 1) % MIN_DURATION_THRESHOLDS.length]!
        setMinDurationMs(next)
      },
      cycleSortKey() {
        const cur = sortKey()
        const idx = SORT_KEYS.indexOf(cur)
        const next = SORT_KEYS[(idx + 1) % SORT_KEYS.length]!
        setSortKey(next)
      },
      cycleMinSpans() {
        const cur = minSpans()
        const idx = MIN_SPANS_THRESHOLDS.indexOf(cur)
        const next = MIN_SPANS_THRESHOLDS[(idx + 1) % MIN_SPANS_THRESHOLDS.length]!
        setMinSpans(next)
      },
    }
  },
})
