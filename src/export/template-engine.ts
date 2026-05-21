import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { TemplateConfig, TemplateSummary } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(__dirname, 'templates');
const DEFAULT_TEMPLATE_ID = 'default';

/**
 * Load a template configuration by ID.
 * Falls back to the default template when templateId is not provided or not found.
 *
 * @param templateId - Optional template identifier. If omitted or not found, uses default.
 * @returns The resolved TemplateConfig.
 */
export async function loadTemplate(templateId?: string): Promise<TemplateConfig> {
  const id = templateId || DEFAULT_TEMPLATE_ID;

  try {
    const filePath = join(TEMPLATES_DIR, `${id}.json`);
    const content = await readFile(filePath, 'utf-8');
    const template: TemplateConfig = JSON.parse(content);
    return template;
  } catch {
    // If the requested template doesn't exist, fall back to default
    if (id !== DEFAULT_TEMPLATE_ID) {
      return loadTemplate(DEFAULT_TEMPLATE_ID);
    }
    // If even the default template can't be loaded, throw
    throw new Error(`Failed to load default template from ${TEMPLATES_DIR}`);
  }
}

/**
 * List all available templates with their id, name, and optional preview.
 *
 * @returns Array of template summaries.
 */
export async function listTemplates(): Promise<TemplateSummary[]> {
  try {
    const files = await readdir(TEMPLATES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const templates: TemplateSummary[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = join(TEMPLATES_DIR, file);
        const content = await readFile(filePath, 'utf-8');
        const template: TemplateConfig = JSON.parse(content);
        templates.push({
          id: template.id,
          name: template.name,
          preview: template.colors?.primary,
        });
      } catch {
        // Skip malformed template files
        continue;
      }
    }

    return templates;
  } catch {
    // If templates directory doesn't exist or can't be read, return empty
    return [];
  }
}
