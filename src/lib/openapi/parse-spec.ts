import i18n from '@/lib/i18n'
import type { OpenAPISpec, ParsedRoute } from './types'
import { resolveRef } from './resolve-ref'
import { convertV2toV3 } from './convert-v2'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

export function parseRoutes(spec: OpenAPISpec): ParsedRoute[] {
  // Convert Swagger 2.0 in-place if needed
  if (spec.swagger === '2.0') convertV2toV3(spec);

  const routes: ParsedRoute[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as any)[method];
      if (!op) continue;
      const tags = op.tags || [i18n.t('endpoints.ungrouped')];
      const resolved = resolveRef(op, spec, new Set());
      const pathParams = resolveRef(pathItem.parameters || [], spec, new Set());
      routes.push({
        method,
        path,
        tags,
        summary: resolved.summary || '',
        description: resolved.description || '',
        operationId: resolved.operationId || '',
        parameters: [...pathParams, ...(resolved.parameters || [])],
        requestBody: resolved.requestBody || null,
        responses: resolved.responses || {},
        security: resolved.security || spec.security || [],
        selected: false,
        referencedModels: [],
      });
    }
  }
  return routes;
}
