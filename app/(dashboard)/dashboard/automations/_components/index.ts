/**
 * Public surface of the Automations UI.
 *
 * The page composes these; everything else in this folder — the summaries, the
 * icon resolver, the builder drafts — is an implementation detail of one of
 * them and is deliberately not re-exported.
 */

export { AutomationsHeader } from "./automations-header";
export { AutomationStatsBar, type AutomationStats } from "./automation-stats-bar";
export { AutomationGateBanner } from "./automation-gate-banner";
export { AutomationList } from "./automation-list";
export { TemplateGallery } from "./template-gallery";
export { ConfirmDeleteDialog } from "./confirm-delete-dialog";
export { TestRunDialog } from "./test-run-dialog";
export { RuleBuilderSheet } from "./rule-builder/rule-builder-sheet";

export {
  statusMeta,
  STATUS_CLASSES,
  type Automation,
  type AutomationAgent,
  type AutomationsPayload,
} from "./types";
