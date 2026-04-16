import type { OpenAPISpec } from "@/lib/openapi/types"
import { runOpenAPIDiagnostics, type OpenAPIDiagnosticsResult } from "@/lib/openapi/diagnostics"
import { getErrorMessage } from "@/lib/openapi/parser"

type WorkerRequest = {
  type: "run-diagnostics"
  requestId: number
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec
}

type WorkerResponse =
  | {
      type: "diagnostics-ready"
      requestId: number
      result: OpenAPIDiagnosticsResult
    }
  | {
      type: "error"
      requestId: number
      message: string
    }

function postMessageToMain(message: WorkerResponse) {
  globalThis.postMessage(message)
}

globalThis.addEventListener("message", event => {
  const request = event.data as WorkerRequest

  void (async () => {
    try {
      postMessageToMain({
        type: "diagnostics-ready",
        requestId: request.requestId,
        result: await runOpenAPIDiagnostics(request.spec, request.sourceSpec),
      })
    } catch (error) {
      postMessageToMain({
        type: "error",
        requestId: request.requestId,
        message: getErrorMessage(error),
      })
    }
  })()
})
