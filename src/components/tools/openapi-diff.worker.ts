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
