import { createSignal } from "solid-js"
import { createSimpleContext } from "./helper"

export const { use: useFilter, provider: FilterProvider } = createSimpleContext({
  name: "Filter",
  init: () => {
    const [searchQuery, setSearchQuery] = createSignal("")
    const [selectedServices, setSelectedServices] = createSignal<Set<string>>(new Set())
    const [showServiceFilter, setShowServiceFilter] = createSignal(false)
    const [showSearch, setShowSearch] = createSignal(false)

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
        setSelectedServices(new Set())
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
    }
  },
})
