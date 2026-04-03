import { createContext, useContext, type JSX } from "solid-js"

export function createSimpleContext<T>(opts: {
  name: string
  init: () => T
}) {
  const ctx = createContext<T>()

  function provider(props: { children: JSX.Element }) {
    const value = opts.init()
    return <ctx.Provider value={value}>{props.children}</ctx.Provider>
  }

  function use(): T {
    const value = useContext(ctx)
    if (value === undefined) {
      throw new Error(`${opts.name}Context must be used within a ${opts.name}Provider`)
    }
    return value
  }

  return { provider, use }
}
