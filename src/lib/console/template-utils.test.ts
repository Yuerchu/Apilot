import { describe, it, expect } from "vitest"
import { findBinaryFieldName, detectConfirmPasswordPair, isDangerousAction, stableEqual } from "./template-utils"
import type { SchemaObject, ParsedRoute } from "@/lib/openapi/types"

function route(method: string, path: string): ParsedRoute {
  return { method, path } as ParsedRoute
}

describe("findBinaryFieldName", () => {
  it("finds format binary property", () => {
    const schema: SchemaObject = { type: "object", properties: { avatar: { type: "string", format: "binary" }, name: { type: "string" } } }
    expect(findBinaryFieldName(schema)).toBe("avatar")
  })

  it("finds format base64 property", () => {
    const schema: SchemaObject = { type: "object", properties: { data: { type: "string", format: "base64" } } }
    expect(findBinaryFieldName(schema)).toBe("data")
  })

  it("returns null when no binary field", () => {
    const schema: SchemaObject = { type: "object", properties: { name: { type: "string" } } }
    expect(findBinaryFieldName(schema)).toBeNull()
  })

  it("returns null for null/empty schema", () => {
    expect(findBinaryFieldName(null)).toBeNull()
    expect(findBinaryFieldName({})).toBeNull()
  })
})

describe("detectConfirmPasswordPair", () => {
  it("detects password + confirm_password", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: {
        password: { type: "string", format: "password" },
        confirm_password: { type: "string", format: "password" },
      },
    }
    expect(detectConfirmPasswordPair(schema)).toEqual({ primary: "password", confirm: "confirm_password" })
  })

  it("detects new_password + password2 by name", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: {
        new_password: { type: "string" },
        password2: { type: "string" },
      },
    }
    expect(detectConfirmPasswordPair(schema)).toEqual({ primary: "new_password", confirm: "password2" })
  })

  it("returns null with a single password field", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: { password: { type: "string", format: "password" }, username: { type: "string" } },
    }
    expect(detectConfirmPasswordPair(schema)).toBeNull()
  })

  it("returns null when two passwords but no confirm naming", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: {
        old_password: { type: "string", format: "password" },
        new_password: { type: "string", format: "password" },
      },
    }
    expect(detectConfirmPasswordPair(schema)).toBeNull()
  })

  it("returns null when ambiguous (three password-like fields, two confirm-like)", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: {
        password: { type: "string", format: "password" },
        password_repeat: { type: "string", format: "password" },
        password_confirm: { type: "string", format: "password" },
      },
    }
    expect(detectConfirmPasswordPair(schema)).toBeNull()
  })

  it("returns null for null schema", () => {
    expect(detectConfirmPasswordPair(null)).toBeNull()
  })
})

describe("isDangerousAction", () => {
  it("DELETE method is dangerous", () => {
    expect(isDangerousAction(route("delete", "/users/{id}"))).toBe(true)
  })

  it("dangerous path keyword with safe method", () => {
    expect(isDangerousAction(route("post", "/cache/purge"))).toBe(true)
    expect(isDangerousAction(route("post", "/users/{id}/reset-password"))).toBe(true)
  })

  it("safe path and method", () => {
    expect(isDangerousAction(route("post", "/users/{id}/activate"))).toBe(false)
    expect(isDangerousAction(route("get", "/stats"))).toBe(false)
  })
})

describe("stableEqual", () => {
  it("key order independent", () => {
    expect(stableEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it("nested objects and arrays", () => {
    expect(stableEqual({ a: [1, { x: "y" }] }, { a: [1, { x: "y" }] })).toBe(true)
    expect(stableEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  })

  it("detects differences", () => {
    expect(stableEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(stableEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(stableEqual(null, {})).toBe(false)
    expect(stableEqual(undefined, null)).toBe(false)
  })

  it("primitives", () => {
    expect(stableEqual("x", "x")).toBe(true)
    expect(stableEqual(1, "1")).toBe(false)
  })
})
