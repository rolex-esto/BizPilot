/**
 * Business workflow rules for order creation.
 * Default: orders are NEVER auto-created — owner must explicitly confirm.
 */

export interface WorkflowRules {
  autoCreateOrderOnDeal?: boolean;
}

export function parseWorkflowRules(settingsJson?: string | null): WorkflowRules {
  if (!settingsJson) return {};
  try {
    const settings = JSON.parse(settingsJson);
    return settings.workflowRules || {};
  } catch {
    return {};
  }
}

/** Returns true only when the business has explicitly enabled auto-order on deal acceptance. */
export function isAutoCreateOrderOnDealEnabled(settingsJson?: string | null): boolean {
  return parseWorkflowRules(settingsJson).autoCreateOrderOnDeal === true;
}
