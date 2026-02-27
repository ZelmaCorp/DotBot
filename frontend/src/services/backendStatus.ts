/**
 * Backend status signals shared across the frontend.
 *
 * Used for blue-green deploys: when the backend starts shutting down
 * it adds a header (`X-Backend-Going-Down: true`) to responses. The
 * API clients call `notifyBackendGoingDown()`, and the App listens
 * and shows a reload banner.
 */

type Listener = () => void;

let backendGoingDown = false;
const listeners = new Set<Listener>();

export function isBackendGoingDown(): boolean {
  return backendGoingDown;
}

export function notifyBackendGoingDown(): void {
  if (backendGoingDown) return;
  backendGoingDown = true;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BackendStatus] Listener error', error);
    }
  });
}

export function subscribeBackendGoingDown(listener: Listener): () => void {
  listeners.add(listener);
  // Immediately fire if we already know the backend is going down
  if (backendGoingDown) {
    try {
      listener();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BackendStatus] Listener error', error);
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

