import { useState, useEffect } from "react"
import { isEnterprise, loadEnterprise } from "./ag-grid-modules"

export function useAgGridEnterprise(): boolean {
  const [ready, setReady] = useState(isEnterprise())

  useEffect(() => {
    if (!__AG_GRID_ENTERPRISE__ || ready) return
    loadEnterprise().then(() => setReady(true))
  }, [ready])

  return ready
}
