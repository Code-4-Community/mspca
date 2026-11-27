/**
 * On-failure destination for mspca-notif-dispatch.
 *
 * Lambda sends this a record once the dispatch Lambda runs out of async retries,
 * so a dropped scheduled notification shows up in this function's logs with its
 * attempt count and original payload. Only logs, never throws, so nothing retries.
 */
export const handler = async (event) => {
  const { requestId, condition, approximateInvokeCount } =
    event.requestContext ?? {};
  console.error(
    `Dispatch gave up (request ${requestId}): ${condition} after ${approximateInvokeCount} attempts`,
    JSON.stringify(event),
  );
};
