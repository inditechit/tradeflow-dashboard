export const PROFILE_COMPLIANCE_REFRESH_EVENT = "profile-compliance-refresh";

export function notifyProfileComplianceRefresh() {
  window.dispatchEvent(new Event(PROFILE_COMPLIANCE_REFRESH_EVENT));
}
