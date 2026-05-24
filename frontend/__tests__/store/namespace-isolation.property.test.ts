import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { makeStore, type RootState } from '../../store/index'

/**
 * Property 11: Redux State Namespace Isolation
 *
 * *For any* Presenton-originated state slice registered in the Redux_Store,
 * its key SHALL be prefixed with `presentation`. No Presenton state key
 * SHALL collide with any PPP state key.
 *
 * **Validates: Requirement 10.1**
 */
describe('Property 11: Redux State Namespace Isolation', () => {
  // Known PPP top-level keys
  const PPP_KEYS = ['auth', 'projects', 'report'] as const

  // Known Presenton sub-keys (nested under 'presentation')
  const PRESENTON_SUB_KEYS = ['data', 'editor', 'theme'] as const

  const store = makeStore()
  const state = store.getState()
  const topLevelKeys = Object.keys(state)

  it('should have all PPP slices at the top level', () => {
    for (const key of PPP_KEYS) {
      expect(topLevelKeys).toContain(key)
    }
  })

  it('should have a "presentation" namespace key at the top level', () => {
    expect(topLevelKeys).toContain('presentation')
  })

  it('should nest all Presenton state under the "presentation" key', () => {
    const presentationState = (state as Record<string, unknown>)['presentation'] as Record<string, unknown>
    expect(presentationState).toBeDefined()
    expect(typeof presentationState).toBe('object')

    for (const subKey of PRESENTON_SUB_KEYS) {
      expect(Object.keys(presentationState)).toContain(subKey)
    }
  })

  it('should not have any top-level key starting with "presentation" other than the namespace itself', () => {
    const presentationPrefixedKeys = topLevelKeys.filter(
      (key) => key.startsWith('presentation') && key !== 'presentation'
    )
    expect(presentationPrefixedKeys).toEqual([])
  })

  it('should have no key collisions between PPP and Presenton state slices (property-based)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (arbitraryKey: string) => {
          // If a key is a PPP key, it must NOT be nested under 'presentation'
          if (PPP_KEYS.includes(arbitraryKey as typeof PPP_KEYS[number])) {
            const presentationState = (state as Record<string, unknown>)['presentation'] as Record<string, unknown>
            expect(Object.keys(presentationState)).not.toContain(arbitraryKey)
          }

          // If a key is a Presenton sub-key, it must NOT exist at the top level
          if (PRESENTON_SUB_KEYS.includes(arbitraryKey as typeof PRESENTON_SUB_KEYS[number])) {
            // Presenton sub-keys should not be top-level keys
            expect(topLevelKeys).not.toContain(arbitraryKey)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should ensure arbitrary slice names do not break namespace isolation (property-based)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (sliceName: string) => {
          // For any arbitrary slice name that starts with 'presentation',
          // if it exists at the top level, it must be exactly 'presentation' (the namespace)
          if (sliceName.startsWith('presentation') && topLevelKeys.includes(sliceName)) {
            expect(sliceName).toBe('presentation')
          }

          // No top-level key should collide with Presenton's internal sub-keys
          // (data, editor, theme should only exist inside 'presentation')
          const presentationState = (state as Record<string, unknown>)['presentation'] as Record<string, unknown>
          const presentationSubKeys = Object.keys(presentationState)

          // Verify isolation: top-level keys and presentation sub-keys are disjoint
          for (const topKey of topLevelKeys) {
            if (topKey === 'presentation') continue
            // PPP top-level keys should not appear as Presenton sub-keys
            if (topKey === sliceName) {
              expect(presentationSubKeys).not.toContain(topKey)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should verify the actual state shape matches the expected namespace structure', () => {
    // The root state should have exactly the expected top-level keys
    const expectedTopLevelKeys = [...PPP_KEYS, 'presentation'].sort()
    expect([...topLevelKeys].sort()).toEqual(expectedTopLevelKeys)

    // The presentation namespace should have exactly the expected sub-keys
    const presentationState = (state as Record<string, unknown>)['presentation'] as Record<string, unknown>
    const actualSubKeys = Object.keys(presentationState).sort()
    const expectedSubKeys = [...PRESENTON_SUB_KEYS].sort()
    expect(actualSubKeys).toEqual(expectedSubKeys)
  })
})
