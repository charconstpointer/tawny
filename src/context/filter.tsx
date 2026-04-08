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

    const MIN_SPANS_THRESHOLDS = [0, 3, 5, 10, 20, 50]

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
      closeSearch() {
        setShowSearch(false)
        setSearchQuery("")
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
