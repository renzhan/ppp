import { describe, it, expect } from 'vitest';
import { loadTemplate, listTemplates } from '../../src/export/template-engine.js';
import type { TemplateConfig } from '../../src/export/types.js';

describe('template-engine', () => {
  describe('loadTemplate', () => {
    it('should load the default template when no templateId is provided', async () => {
      const template = await loadTemplate();

      expect(template).toBeDefined();
      expect(template.id).toBe('default');
      expect(template.name).toBe('默认模板');
    });

    it('should load the default template when templateId is undefined', async () => {
      const template = await loadTemplate(undefined);

      expect(template.id).toBe('default');
    });

    it('should load the default template when templateId is empty string', async () => {
      const template = await loadTemplate('');

      expect(template.id).toBe('default');
    });

    it('should fall back to default template when templateId does not exist', async () => {
      const template = await loadTemplate('non-existent-template');

      expect(template.id).toBe('default');
      expect(template.name).toBe('默认模板');
    });

    it('should return a valid TemplateConfig structure', async () => {
      const template = await loadTemplate();

      // Verify all required fields exist
      expect(template.fonts).toBeDefined();
      expect(template.fonts.heading).toBe('Microsoft YaHei');
      expect(template.fonts.body).toBe('Microsoft YaHei');

      expect(template.colors).toBeDefined();
      expect(template.colors.primary).toBe('#1a1a2e');
      expect(template.colors.secondary).toBe('#16213e');
      expect(template.colors.accent).toBe('#e94560');

      expect(template.spacing).toBeDefined();
      expect(template.spacing.lineHeight).toBe(1.6);
      expect(template.spacing.paragraphSpacing).toBe(12);

      expect(template.margins).toBeDefined();
      expect(template.margins.top).toBe(72);
      expect(template.margins.bottom).toBe(72);
      expect(template.margins.left).toBe(72);
      expect(template.margins.right).toBe(72);

      expect(template.headerFooter).toBeDefined();
      expect(template.headerFooter.footer).toBe('{{projectName}} - {{brand}} | 第{{page}}页');
    });

    it('should load a specific template by ID when it exists', async () => {
      // The default template should be loadable by its explicit ID
      const template = await loadTemplate('default');

      expect(template.id).toBe('default');
      expect(template.name).toBe('默认模板');
    });
  });

  describe('listTemplates', () => {
    it('should return an array of template summaries', async () => {
      const templates = await listTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(1);
    });

    it('should include the default template in the list', async () => {
      const templates = await listTemplates();

      const defaultTemplate = templates.find((t) => t.id === 'default');
      expect(defaultTemplate).toBeDefined();
      expect(defaultTemplate!.name).toBe('默认模板');
    });

    it('should include id and name for each template', async () => {
      const templates = await listTemplates();

      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(typeof template.id).toBe('string');
        expect(template.name).toBeDefined();
        expect(typeof template.name).toBe('string');
      }
    });

    it('should include preview field (primary color) for templates', async () => {
      const templates = await listTemplates();

      const defaultTemplate = templates.find((t) => t.id === 'default');
      expect(defaultTemplate!.preview).toBe('#1a1a2e');
    });
  });
});
