import { useMemo } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { computeSpecId } from "@/lib/spec-id"

export function useSpecId(): string | null {
  const { state } = useOpenAPIContext()
  return useMemo(
    () => state.spec ? computeSpecId(state.spec, state.baseUrl, state.specUrl) : null,
    [state.spec, state.baseUrl, state.specUrl],
  )
}
