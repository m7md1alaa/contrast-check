import { z } from 'zod';

export const checkOptionsSchema = z.object({
  output: z.string().min(1, 'Output path cannot be empty').default('./contrast-report.html'),
  headless: z.boolean().default(true),
  viewport: z
    .string()
    .regex(/^\d+x\d+$/, 'Viewport must be in WxH format (e.g. 1280x720)')
    .default('1280x720'),
  darkMode: z.boolean().optional(),
  format: z.enum(['html', 'json', 'compact'], {
    message: 'Format must be one of: html, json, compact',
  }).default('html'),
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
  watch: z.boolean().optional(),
  all: z.boolean().optional(),
  depth: z.coerce.number().int().min(1, 'Depth must be a positive integer').default(1),
  maxPages: z.coerce
    .number()
    .int()
    .min(1, 'Max pages must be a positive integer')
    .default(10),
  yes: z.boolean().optional(),
  crawl: z.boolean().optional(),
});

export type ValidatedCheckOptions = z.infer<typeof checkOptionsSchema>;

export const urlArgumentSchema = z
  .string()
  .min(1, 'URL is required')
  .refine((val) => !val.startsWith('-'), {
    message: 'URL cannot start with "-" (did you mean to pass a flag?)',
  });
