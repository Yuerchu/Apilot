import { describe, expect, it } from "vitest"
import {
  buildSchemaFieldExtensions,
  normalizeCrossFieldRules,
  normalizeFileConstraints,
  normalizeSchemaViewerDocument,
  normalizeStandardSchemaRules,
} from "@/lib/schema-viewer"

describe("schema viewer adapter", () => {
  it("normalizes generator schema files with extension constraints", () => {
    const items = normalizeSchemaViewerDocument([
      {
        id: "video",
        name: "Video model",
        category: "video",
        response_type: "file_list",
        endpoint: "/api/video",
        schema: {
          type: "object",
          properties: {
            first_frame_image_id: { type: "string" },
            end_frame_image_id: { type: "string" },
          },
        },
        x_constraints: [
          {
            when: { field: "first_frame_image_id", has_items: true },
            then: { field: "end_frame_image_id", required: true },
          },
        ],
        file_constraints: {
          constraints: {
            reference_image_ids: {
              accept: {
                "image/png": { max_size: 1024 },
              },
              max_count: 2,
              max_total_size: 4096,
              role: "reference",
            },
          },
        },
      },
    ], "fallback.json")

    expect(items).toHaveLength(1)
    expect(items[0]?.name).toBe("Video model")
    expect(items[0]?.crossFieldRules[0]?.conditions[0]).toEqual({
      field: "first_frame_image_id",
      operator: "has_items",
      value: true,
    })
    expect(items[0]?.crossFieldRules[0]?.actions[0]).toEqual({
      field: "end_frame_image_id",
      operator: "required",
      value: true,
    })
    expect(items[0]?.fileConstraints[0]?.accepts[0]).toEqual({
      mimeType: "image/png",
      limits: { max_size: 1024 },
    })

    const extensions = buildSchemaFieldExtensions(items[0]!)
    expect(extensions.get("reference_image_ids")?.fileConstraint?.role).toBe("reference")
    expect(extensions.get("first_frame_image_id")?.dynamicRules[0]?.role).toBe("condition")
    expect(extensions.get("end_frame_image_id")?.dynamicRules[0]).toMatchObject({
      index: 0,
      role: "action",
    })
  })

  it("normalizes raw cross-field rules", () => {
    const rules = normalizeCrossFieldRules([
      {
        when: [
          { field: "a", eq: "x" },
          { field: "b", has_items: false },
        ],
        then: { field: "c", visible: false },
      },
    ])

    expect(rules[0]?.conditions).toHaveLength(2)
    expect(rules[0]?.actions[0]).toEqual({
      field: "c",
      operator: "visible",
      value: false,
    })
  })

  it("normalizes file constraints", () => {
    const rules = normalizeFileConstraints({
      constraints: {
        file_ids: {
          accept: {
            "application/pdf": { max_size: 1024 },
            "text/plain": { max_size: 512 },
          },
          max_count: 4,
        },
      },
    })

    expect(rules).toHaveLength(1)
    expect(rules[0]?.field).toBe("file_ids")
    expect(rules[0]?.accepts.map(rule => rule.mimeType)).toEqual(["application/pdf", "text/plain"])
  })

  it("extracts standard JSON Schema conditional rules", () => {
    const rules = normalizeStandardSchemaRules({
      type: "object",
      dependentRequired: {
        credit_card: ["billing_address"],
      },
      if: {
        properties: {
          mode: { const: "advanced" },
        },
      },
      then: {
        required: ["advanced_config"],
      },
    })

    expect(rules.map(rule => rule.keyword)).toEqual(["if/then/else", "dependentRequired"])
    expect(rules[1]?.detail).toBe("credit_card -> billing_address")
  })
})
