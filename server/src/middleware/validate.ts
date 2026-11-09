import type { Request } from 'express';
import type { z } from 'zod';
import { badRequest } from '../lib/errors';

export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
    throw badRequest('Please check the highlighted fields', 'VALIDATION_ERROR', fields);
  }
  return result.data;
}

export function parseQuery<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.query);
  if (!result.success) throw badRequest('Invalid query parameters', 'VALIDATION_ERROR');
  return result.data;
}
