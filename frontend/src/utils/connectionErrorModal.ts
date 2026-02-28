/**
 * Global trigger for the connection error modal.
 * Use this from any context (async callbacks, promise chains) so the modal always shows.
 */

export const SHOW_CONNECTION_ERROR_EVENT = 'dotbot-show-connection-error';

export function showConnectionErrorModal(message: string): void {
  window.dispatchEvent(
    new CustomEvent(SHOW_CONNECTION_ERROR_EVENT, { detail: { message } })
  );
}
