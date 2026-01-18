import { ZodError } from 'zod';

export function translateZodError(error: ZodError): string {
  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `'${issue.path.join('.')}'` : 'Value';
    return `${path}: ${issue.message}`;
  });
  return messages.join('. ');
}

export function formatZodErrors(
  error: ZodError
): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: String(issue.path.join('.')) || 'body',
    message: issue.message,
  }));
}