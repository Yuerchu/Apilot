import type { SchemaObject } from "./types"
import { sample } from "openapi-sampler"

export function generateExample(schema: SchemaObject | null | undefined, _depth: number = 0): unknown {
  if (!schema) return null
  if (schema._circular || schema._unresolved) return null
  try {
    return sample(schema as Record<string, unknown>)
  } catch {
    return null
  }
}
