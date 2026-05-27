export const SUBSCRIPTION_REFRESH_EVENT = "subscription-refresh";

export function notifySubscriptionRefresh() {
  window.dispatchEvent(new Event(SUBSCRIPTION_REFRESH_EVENT));
}
