/**
 * Report module toggle logic.
 *
 * Manages the state of report module toggles, ensuring that toggling
 * one module only affects that module's state while leaving all others unchanged.
 */

export const REPORT_MODULE_KEYS = [
  'projectReview',
  'dataOverview',
  'highlights',
  'comprehensiveAnalysis',
  'contentAnalysis',
  'launchAnalysis',
  'optimization',
] as const;

export type ReportModuleKey = (typeof REPORT_MODULE_KEYS)[number];

export type ModuleState = Record<string, boolean>;

/**
 * Creates a default module state with all modules enabled.
 */
export function createDefaultModuleState(): ModuleState {
  const state: ModuleState = {};
  for (const key of REPORT_MODULE_KEYS) {
    state[key] = true;
  }
  return state;
}

/**
 * Toggles a single module's state, returning a new state object.
 * Only the specified module's enabled/disabled state changes;
 * all other modules retain their previous state.
 */
export function toggleModule(state: ModuleState, moduleKey: string): ModuleState {
  return {
    ...state,
    [moduleKey]: !state[moduleKey],
  };
}

/**
 * 全选：将所有模块设置为选中状态。
 */
export function selectAllModules(state: ModuleState): ModuleState {
  const newState: ModuleState = { ...state };
  for (const key of REPORT_MODULE_KEYS) {
    newState[key] = true;
  }
  return newState;
}

/**
 * 取消全选：将所有模块设置为未选中状态。
 */
export function deselectAllModules(state: ModuleState): ModuleState {
  const newState: ModuleState = { ...state };
  for (const key of REPORT_MODULE_KEYS) {
    newState[key] = false;
  }
  return newState;
}
