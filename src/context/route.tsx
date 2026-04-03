import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import type { Route } from "../types"

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [store, setStore] = createStore<Route>({ type: "trace-list" })

    return {
      get data() {
        return store
      },
      navigate(route: Route) {
        setStore(route)
      },
      back() {
        if (store.type === "span-detail") {
          setStore({ type: "trace-detail", traceId: store.traceId })
        } else if (store.type === "trace-detail") {
          setStore({ type: "trace-list" })
        }
      },
    }
  },
})
