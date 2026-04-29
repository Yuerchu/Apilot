import { describe, expect, it } from "vitest"
import {
  credentialFromLegacyEnvironment,
  mergeEnvVars,
  toV6EnvVarRecord,
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
