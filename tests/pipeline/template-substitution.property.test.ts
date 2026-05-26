import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';

/**
 * Property 1: Template variable substitution completeness
 * Validates: Requirements 2.2, 2.5
 *
 * For any prompt template string containing {{variable_name}} placeholders
 * and for any data context record, after substitution:
 * (a) all variables present in the data context are replaced with their corresponding values,
 * (b) all variables NOT present in the data context are replaced with empty strings, and
 * (c) no {{...}} placeholders remain in the output.
 */
describe('Feature: report-generation-pipeline, Property 1: Template variable substitution completeness', () => {
  const loader = new PromptTemplateLoader('');

  // Generator for valid variable names (word characters only, non-empty)
  const variableNameArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_0123456789'.split('')),
    { minLength: 1, maxLength: 20 }
  ).filter((s) => /^\w+$/.test(s) && !/^\d/.test(s));

  // Generator for variable values (any string without {{ or }})
  const variableValueArb = fc.string({ minLength: 0, maxLength: 100 })
    .map((s) => s.replace(/\{\{/g, '').replace(/\}\}/g, ''));

  // Generator for template text segments (text between variables, no {{ or }})
  const textSegmentArb = fc.string({ minLength: 0, maxLength: 50 })
    .map((s) => s.replace(/\{\{/g, '').replace(/\}\}/g, ''));

  // Generator for a template with known variable placeholders
  const templateWithVarsArb = fc.tuple(
    fc.array(variableNameArb, { minLength: 1, maxLength: 10 }),
    fc.array(textSegmentArb, { minLength: 2, maxLength: 11 })
  ).map(([varNames, textSegments]) => {
    // Interleave text segments with variable placeholders
    let template = '';
    for (let i = 0; i < varNames.length; i++) {
      template += (textSegments[i] ?? '') + `{{${varNames[i]}}}`;
    }
    template += textSegments[varNames.length] ?? '';
    return { template, varNames };
  });

  it('should replace all present variables with their values (property a)', () => {
    fc.assert(
      fc.property(
        templateWithVarsArb,
        fc.dictionary(variableNameArb, variableValueArb, { minKeys: 0, maxKeys: 10 }),
        ({ template, varNames }, extraVars) => {
          // Build a context that has values for ALL variables in the template
          const variables: Record<string, string> = {};
          for (const name of varNames) {
            variables[name] = `value_of_${name}`;
          }
          // Add extra vars that may or may not be in the template
          Object.assign(variables, extraVars);

          const result = loader.substituteVariables(template, variables);

          // (a) All variables present in the data context are replaced with their values
          for (const name of varNames) {
            expect(result).toContain(variables[name]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should replace missing variables with empty strings (property b)', () => {
    fc.assert(
      fc.property(
        templateWithVarsArb,
        ({ template, varNames }) => {
          // Provide an empty context — all variables are "missing"
          const result = loader.substituteVariables(template, {});

          // (b) Variables NOT in context are replaced with empty strings
          // The result should not contain any of the variable values
          // and the placeholders should be gone
          for (const name of varNames) {
            expect(result).not.toContain(`{{${name}}}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should leave no {{...}} placeholders in the output (property c)', () => {
    fc.assert(
      fc.property(
        templateWithVarsArb,
        fc.dictionary(variableNameArb, variableValueArb, { minKeys: 0, maxKeys: 5 }),
        ({ template }, partialContext) => {
          // Use a partial context — some variables may be missing
          const result = loader.substituteVariables(template, partialContext);

          // (c) No {{...}} placeholders remain in the output
          expect(result).not.toMatch(/\{\{\w+\}\}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should satisfy all three properties simultaneously', () => {
    fc.assert(
      fc.property(
        templateWithVarsArb,
        fc.dictionary(variableNameArb, variableValueArb, { minKeys: 0, maxKeys: 10 }),
        ({ template, varNames }, context) => {
          const result = loader.substituteVariables(template, context);

          // (a) Variables present in context are replaced with their values
          for (const name of varNames) {
            if (name in context) {
              expect(result).toContain(context[name]);
            }
          }

          // (b) Variables NOT in context are replaced with empty strings (no placeholder remains)
          for (const name of varNames) {
            if (!(name in context)) {
              expect(result).not.toContain(`{{${name}}}`);
            }
          }

          // (c) No {{...}} placeholders remain
          expect(result).not.toMatch(/\{\{\w+\}\}/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
