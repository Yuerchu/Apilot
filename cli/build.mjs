import { build } from "esbuild"

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  external: ["node:*"],
  alias: { "@": "./src" },
  banner: {
    js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
  },
}

await build({
  ...shared,
  entryPoints: ["cli/src/index.ts"],
  outfile: "cli/index.mjs",
})

await build({
  ...shared,
  entryPoints: ["cli/src/mcp/server.ts"],
  outfile: "cli/mcp.mjs",
})

console.log("✓ Built cli/index.mjs + cli/mcp.mjs")
