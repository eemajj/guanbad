import type { Instrumentation } from "next";

/** Errors thrown while rendering pages or route handlers, logged as one JSON line each (see server/log.ts). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      ref: err.digest,
      scope: "render",
      path: request.path,
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      error: { name: err.name, message: err.message, stack: err.stack },
    }),
  );
};
