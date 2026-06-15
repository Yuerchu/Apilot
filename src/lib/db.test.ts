import { describe, expect, it } from "vitest"
import {
  credentialFromLegacyEnvironment,
  mergeEnvVars,
  toV6EnvVarRecord,
  redactBody,
  redactParams,
  type EnvVarEntry,
} from "@/lib/db"

describe("db v6 migration helpers", () => {
  it("moves legacy environment auth into a credential record", () => {
    const credential = credentialFromLegacyEnvironment({
      id: "env-1",
      authType: "bearer",
      authToken: "token",
      authUser: "user",
      authKeyName: "X-Key",
      oauth2Token: "",
      updatedAt: 123,
    })

    expect(credential).toEqual({
      envId: "env-1",
      authType: "bearer",
      authToken: "token",
      authUser: "user",
      authKeyName: "X-Key",
      oauth2Token: null,
      updatedAt: 123,
    })
  })

  it("normalizes old document-level env vars to the v6 id shape", () => {
    expect(toV6EnvVarRecord({
      id: "spec-1::token",
      specId: "spec-1",
      key: "token",
      value: "abc",
    })).toEqual({
      id: "spec-1::doc::token",
      specId: "spec-1",
      envId: null,
      key: "token",
      value: "abc",
    })
  })

  it("lets environment variables override document variables", () => {
    const documentVars: EnvVarEntry[] = [
      { id: "s::doc::host", specId: "s", envId: null, key: "host", value: "doc" },
      { id: "s::doc::shared", specId: "s", envId: null, key: "shared", value: "doc" },
    ]
    const environmentVars: EnvVarEntry[] = [
      { id: "s::env::host", specId: "s", envId: "env", key: "host", value: "env" },
    ]

    expect(mergeEnvVars(documentVars, environmentVars)).toEqual([
      { id: "s::env::host", specId: "s", envId: "env", key: "host", value: "env" },
      { id: "s::doc::shared", specId: "s", envId: null, key: "shared", value: "doc" },
    ])
  })
})

describe("history redaction", () => {
  it("masks sensitive keys in a JSON body, including nested ones", () => {
    const out = redactBody(JSON.stringify({
      username: "alice",
      password: "hunter2",
      data: { access_token: "abc.def.ghi", note: "ok" },
    }))
    const parsed = JSON.parse(out!)
    expect(parsed.username).toBe("alice")
    expect(parsed.password).toBe("***")
    expect(parsed.data.access_token).toBe("***")
    expect(parsed.data.note).toBe("ok")
  })

  it("masks sensitive keys in urlencoded bodies (OAuth password grant)", () => {
    const out = redactBody("grant_type=password&username=alice&password=hunter2")
    const sp = new URLSearchParams(out!)
    expect(sp.get("username")).toBe("alice")
    expect(sp.get("password")).toBe("***")
    expect(sp.get("grant_type")).toBe("password")
  })

  it("does not over-redact innocent keys that merely contain a sensitive substring", () => {
    const out = redactBody(JSON.stringify({ author: "bob", keyboard: "qwerty" }))
    const parsed = JSON.parse(out!)
    expect(parsed.author).toBe("bob")
    expect(parsed.keyboard).toBe("qwerty")
  })

  it("leaves non-JSON, non-form bodies untouched and passes null through", () => {
    expect(redactBody("plain text")).toBe("plain text")
    expect(redactBody(null)).toBe(null)
  })

  it("redactParams masks sensitive param names by normalized key", () => {
    expect(redactParams({ id: "5", apiKey: "secret123", access_token: "t" })).toEqual({
      id: "5",
      apiKey: "***",
      access_token: "***",
    })
  })
})
