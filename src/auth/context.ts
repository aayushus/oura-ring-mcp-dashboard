import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  userId: number;
  ouraClient?: any;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Retrieve the active user ID from the request context
 */
export function getContextUserId(): number | undefined {
  return requestContextStorage.getStore()?.userId;
}

/**
 * Retrieve the active Oura client from the request context
 */
export function getContextOuraClient(): any | undefined {
  return requestContextStorage.getStore()?.ouraClient;
}
