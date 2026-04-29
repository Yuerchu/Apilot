import { useCallback, useEffect, useMemo, useState } from "react"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useSpecId } from "@/hooks/use-spec-id"
import {
  deleteSpec,
  getSpecs,
  touchSpec,
  type SpecRecord,
} from "@/lib/db"

export interface UseSpecsResult {
  specs: SpecRecord[]
  latestSpec: SpecRecord | null
  loading: boolean
  refreshSpecs: () => Promise<void>
  loadSpec: (specId: string) => Promise<void>
  forgetSpec: (specId: string) => Promise<void>
}

export function useSpecs(): UseSpecsResult {
  const currentSpecId = useSpecId()
  const { loadFromUrl } = useOpenAPI()
  const { dispatch } = useOpenAPIContext()
  const { dispatch: asyncDispatch } = useAsyncAPIContext()
  const [specs, setSpecs] = useState<SpecRecord[]>([])
  const [loading, setLoading] = useState(false)

  const refreshSpecs = useCallback(async () => {
    const records = await getSpecs()
    setSpecs(records)
  }, [])

  useEffect(() => {
    let active = true
    getSpecs().then(records => {
      if (active) setSpecs(records)
    })
    return () => { active = false }
  }, [currentSpecId])

  const latestSpec = useMemo(() => specs[0] ?? null, [specs])

  const loadSpec = useCallback(async (specId: string) => {
    const spec = specs.find(item => item.id === specId)
    if (!spec || spec.sourceType !== "url" || !spec.specUrl) return

    setLoading(true)
    try {
      await touchSpec(spec.id)
      await loadFromUrl(spec.specUrl)
      await refreshSpecs()
    } finally {
      setLoading(false)
    }
  }, [loadFromUrl, refreshSpecs, specs])

  const forgetSpec = useCallback(async (specId: string) => {
    setLoading(true)
    try {
      await deleteSpec(specId)
      await refreshSpecs()
      if (currentSpecId === specId) {
        dispatch({ type: "RESET" })
        asyncDispatch({ type: "RESET" })
      }
    } finally {
      setLoading(false)
    }
  }, [asyncDispatch, currentSpecId, dispatch, refreshSpecs])

  return {
    specs,
    latestSpec,
    loading,
    refreshSpecs,
    loadSpec,
    forgetSpec,
  }
}
