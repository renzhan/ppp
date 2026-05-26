import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

/**
 * Metadata extracted from YAML front-matter of a prompt template file.
 */
export interface PromptTemplateMetadata {
  chapter_number: number;
  chapter_name: string;
  required_data_sources: string[];
  output_format: 'paragraphs' | 'bullets' | 'table' | 'structured';
  system_prompt?: string;
  fallback_text: string;
}

/**
 * A fully loaded template with parsed metadata and template body.
 */
export interface LoadedTemplate {
  metadata: PromptTemplateMetadata;
  systemPrompt: string;
  userPromptTemplate: string; // Contains {{variable}} placeholders
}

/**
 * PromptTemplateLoader handles loading chapter prompt templates from disk,
 * parsing YAML front-matter metadata, and substituting template variables.
 */
export class PromptTemplateLoader {
  constructor(private templatesDir: string) {}

  /**
   * Load a template file for the given chapter number.
   * Searches the templates directory for a file matching `chapter-{NN}-*.md`.
   */
  loadTemplate(chapterNumber: number): LoadedTemplate {
    const paddedNumber = String(chapterNumber).padStart(2, '0');
    const files = readdirSync(this.templatesDir);
    const templateFile = files.find((f) =>
      f.startsWith(`chapter-${paddedNumber}-`) && f.endsWith('.md')
    );

    if (!templateFile) {
      throw new Error(
        `Template file not found for chapter ${chapterNumber} in ${this.templatesDir}`
      );
    }

    const filePath = resolve(this.templatesDir, templateFile);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata, body } = this.parseYAMLFrontMatter(content);

    const systemPrompt = metadata.system_prompt ?? '';

    return {
      metadata,
      systemPrompt,
      userPromptTemplate: body,
    };
  }

  /**
   * Substitute `{{variable_name}}` placeholders in a template string with values
   * from the provided variables record.
   *
   * - Variables present in the record are replaced with their corresponding values.
   * - Variables NOT present in the record are replaced with empty strings and a warning is logged.
   * - After substitution, no `{{...}}` placeholders remain in the output.
   */
  substituteVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
      if (varName in variables) {
        return variables[varName];
      }
      console.warn(
        `[TemplateLoader] Missing variable: {{${varName}}} — substituted with empty string`
      );
      return '';
    });
  }

  /**
   * Parse a Markdown file content that has a YAML front-matter block delimited by `---`.
   * Returns the parsed metadata object and the remaining body content.
   */
  parseYAMLFrontMatter(content: string): { metadata: PromptTemplateMetadata; body: string } {
    const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      throw new Error('Invalid template format: missing YAML front-matter delimiters (---)');
    }

    const yamlContent = match[1];
    const body = match[2];

    const parsed = parseYaml(yamlContent);

    const metadata: PromptTemplateMetadata = {
      chapter_number: parsed.chapter_number,
      chapter_name: String(parsed.chapter_name),
      required_data_sources: parsed.required_data_sources ?? [],
      output_format: parsed.output_format ?? 'paragraphs',
      system_prompt: parsed.system_prompt,
      fallback_text: String(parsed.fallback_text ?? ''),
    };

    return { metadata, body };
  }
}
