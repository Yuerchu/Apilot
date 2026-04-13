import type { OpenAPISpec } from './types'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

export function convertV2toV3(s: OpenAPISpec): OpenAPISpec {
  // Build servers from host + basePath + schemes
  const scheme = (s.schemes && s.schemes[0]) || 'https';
  const host = s.host || '';
  const basePath = (s.basePath || '').replace(/\/$/, '');
  if (host) {
    s.servers = [{ url: `${scheme}://${host}${basePath}`, description: 'Converted from Swagger 2.0' }];
  }

  // Convert definitions → components.schemas
  if (s.definitions && !s.components) {
    s.components = { schemas: s.definitions };
    // Rewrite $refs: #/definitions/X → #/components/schemas/X
    const rewriteRefs = (obj: any): void => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(rewriteRefs); return; }
      if (obj.$ref && typeof obj.$ref === 'string' && obj.$ref.startsWith('#/definitions/')) {
        obj.$ref = obj.$ref.replace('#/definitions/', '#/components/schemas/');
      }
      for (const v of Object.values(obj)) rewriteRefs(v);
    };
    rewriteRefs(s.paths);
    rewriteRefs(s.components);
  }

  // Convert securityDefinitions → components.securitySchemes
  if (s.securityDefinitions) {
    if (!s.components) s.components = {};
    s.components.securitySchemes = s.securityDefinitions;
  }

  // Convert each operation: body/formData params → requestBody
  const globalConsumes = s.consumes || ['application/json'];
  for (const pathItem of Object.values(s.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as any)[method];
      if (!op) continue;
      const params: any[] = op.parameters || [];
      const bodyParam = params.find((p: any) => p.in === 'body');
      const formParams = params.filter((p: any) => p.in === 'formData');
      const consumes: string[] = op.consumes || globalConsumes;

      // Remove body/formData from parameters
      op.parameters = params.filter((p: any) => p.in !== 'body' && p.in !== 'formData');

      if (bodyParam && !op.requestBody) {
        const ct = consumes[0] || 'application/json';
        op.requestBody = {
          required: !!bodyParam.required,
          content: { [ct]: { schema: bodyParam.schema || {} } }
        };
      } else if (formParams.length && !op.requestBody) {
        const isFileUpload = formParams.some((p: any) => p.type === 'file');
        const ct = isFileUpload
          ? 'multipart/form-data'
          : (consumes.includes('multipart/form-data') ? 'multipart/form-data' : 'application/x-www-form-urlencoded');
        const props: Record<string, any> = {};
        const required: string[] = [];
        for (const fp of formParams) {
          if (fp.type === 'file') {
            props[fp.name] = { type: 'string', format: 'binary', description: fp.description || '' };
          } else {
            props[fp.name] = { type: fp.type || 'string', format: fp.format, enum: fp.enum, default: fp.default, description: fp.description || '' };
          }
          if (fp.required) required.push(fp.name);
        }
        op.requestBody = {
          content: { [ct]: { schema: { type: 'object', properties: props, required: required.length ? required : undefined } } }
        };
      }

      // Convert response schemas: responses.200.schema → responses.200.content
      const produces: string[] = op.produces || s.produces || ['application/json'];
      for (const [, resp] of Object.entries(op.responses || {} as Record<string, any>)) {
        const r = resp as any;
        if (r.schema && !r.content) {
          const mt = produces[0] || 'application/json';
          r.content = { [mt]: { schema: r.schema } };
          delete r.schema;
        }
      }
    }
  }
  return s;
}
