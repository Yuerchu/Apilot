import { diffOpenAPISpecs, type OpenAPIDiffResult } from "@/lib/openapi/diff"
import { getErrorMessage, normalizeParsedSpec, parseSpecText, parseValidatedSpec } from "@/lib/openapi/parser"
import type { OpenAPISpec } from "@/lib/openapi/types"

type DiffSlotName = "before" | "after"

type WorkerRequest =
  | {
      type: "parse-slot"
      requestId: number
      slot: DiffSlotName
      name: string
      text: string
    }
  | {
      type: "set-slot"
      requestId: number
      slot: DiffSlotName
      name: string
      spec: OpenAPISpec
    }
  | {
      type: "compute-diff"
      requestId: number
    }
  | {
      type: "store-spec"
      requestId: number
      key: string
      name: string
      spec: OpenAPISpec
    }
  | {
      type: "compute-pair-diff"
      requestId: number
      fromKey: string
      toKey: string
    }

type WorkerResponse =
  | {
      type: "slot-ready"
      requestId: number
      slot: DiffSlotName
      name: string
    }
  | {
      type: "diff-ready"
      requestId: number
      result: OpenAPIDiffResult
    }
  | {
      type: "spec-stored"
      requestId: number
      key: string
    }
  | {
      type: "pair-diff-ready"
      requestId: number
      fromKey: string
      toKey: string
      result: OpenAPIDiffResult
    }
  | {
      type: "error"
      requestId: number
      message: string
      slot?: DiffSlotName
    }

interface StoredDiffSpec {
  name: string
  spec: OpenAPISpec
}

const slots: Record<DiffSlotName, StoredDiffSpec | null> = {
  before: null,
  after: null,
}

const namedSpecs = new Map<string, StoredDiffSpec>()

function postMessageToMain(message: WorkerResponse) {
  globalThis.postMessage(message)
}

async function parseSlotText(name: string, text: string): Promise<StoredDiffSpec> {
  const parsed = parseSpecText(text)
  const { spec } = await parseValidatedSpec(parsed)
  return {
    name,
    spec: normalizeParsedSpec(spec),
  }
}

globalThis.addEventListener("message", event => {
  const request = event.data as WorkerRequest

  void (async () => {
    try {
      if (request.type === "parse-slot") {
        slots[request.slot] = await parseSlotText(request.name, request.text)
        postMessageToMain({
          type: "slot-ready",
          requestId: request.requestId,
          slot: request.slot,
          name: request.name,
        })
        return
      }

      if (request.type === "set-slot") {
        slots[request.slot] = {
          name: request.name,
          spec: normalizeParsedSpec(request.spec),
        }
        postMessageToMain({
          type: "slot-ready",
          requestId: request.requestId,
          slot: request.slot,
          name: request.name,
        })
        return
      }

      if (request.type === "store-spec") {
        namedSpecs.set(request.key, {
          name: request.name,
          spec: normalizeParsedSpec(request.spec),
        })
        postMessageToMain({
          type: "spec-stored",
          requestId: request.requestId,
          key: request.key,
        })
        return
      }

      if (request.type === "compute-pair-diff") {
        const from = namedSpecs.get(request.fromKey)
        const to = namedSpecs.get(request.toKey)
        if (!from || !to) {
          throw new Error(`Missing spec: ${!from ? request.fromKey : request.toKey}`)
        }
        postMessageToMain({
          type: "pair-diff-ready",
          requestId: request.requestId,
          fromKey: request.fromKey,
          toKey: request.toKey,
          result: diffOpenAPISpecs(from.spec, to.spec),
        })
        return
      }

      const before = slots.before
      const after = slots.after
      if (!before || !after) {
        throw new Error("Both specs are required")
      }

      postMessageToMain({
        type: "diff-ready",
        requestId: request.requestId,
        result: diffOpenAPISpecs(before.spec, after.spec),
      })
    } catch (error) {
      const response: WorkerResponse = {
        type: "error",
        requestId: request.requestId,
        message: getErrorMessage(error),
        ...("slot" in request ? { slot: request.slot } : {}),
      }
      postMessageToMain(response)
    }
  })()
})
