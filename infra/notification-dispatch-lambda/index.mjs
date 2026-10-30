/**
 * EventBridge Scheduler target for scheduled bulk notifications.
 *
 * Carries no business logic. Scheduler passes the notification stored in the
 * schedule's Input as this handler's event, and the handler forwards it to the
 * backend, which resolves the recipients at send time and sends the email.
 *
 * Environment:
 *   NOTIFICATIONS_DISPATCH_URL     https://<api host>/api/notifications/send-scheduled
 *   NOTIFICATIONS_DISPATCH_SECRET  must match the backend's value
 */
export const handler = async (event) => {
  const url = process.env.NOTIFICATIONS_DISPATCH_URL;
  const secret = process.env.NOTIFICATIONS_DISPATCH_SECRET;

  if (!url || !secret) {
    throw new Error(
      'NOTIFICATIONS_DISPATCH_URL and NOTIFICATIONS_DISPATCH_SECRET must both be set',
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-notifications-dispatch-secret': secret,
    },
    body: JSON.stringify(event),
  });

  // Scheduler invokes this Lambda asynchronously, so throwing triggers Lambda's async
  // retries (up to 2 by default, set in the function's async invocation config).
  if (!response.ok) {
    throw new Error(
      `Dispatch failed: ${response.status} ${await response.text()}`,
    );
  }
};
