/**
 * Notification Service
 *
 * Provides three notification mechanisms:
 * 1. sendDesktopNotification() - Browser desktop notifications (requires user permission)
 * 2. showToast() - In-page toast notifications
 * 3. flashTabTitle() - Tab title flashing for background tabs
 */

// ============================================================
// Types
// ============================================================

export interface NotificationOptions {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number; // ms, default 5000
}

// ============================================================
// Desktop Notification
// ============================================================

/**
 * Request permission for desktop notifications.
 * Returns true if permission is granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof window.Notification === 'undefined'
  ) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Send a browser desktop notification.
 * Requires user to have granted notification permission.
 * Silently does nothing if permission is not granted or API is unavailable.
 */
export function sendDesktopNotification(title: string, body: string): void {
  if (
    typeof window === 'undefined' ||
    typeof window.Notification === 'undefined'
  ) {
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }
  new Notification(title, { body });
}

// ============================================================
// Toast Notification
// ============================================================

const TOAST_CONTAINER_ID = 'notification-toast-container';

function getOrCreateToastContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = [
      'position: fixed',
      'top: 16px',
      'right: 16px',
      'z-index: 99999',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
      'pointer-events: none',
    ].join(';');
    document.body.appendChild(container);
  }
  return container;
}

function getToastColors(type: NotificationOptions['type']): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (type) {
    case 'success':
      return {
        bg: '#f0fdf4',
        border: '#86efac',
        text: '#166534',
        icon: '✓',
      };
    case 'error':
      return {
        bg: '#fef2f2',
        border: '#fca5a5',
        text: '#991b1b',
        icon: '✕',
      };
    case 'info':
      return {
        bg: '#eff6ff',
        border: '#93c5fd',
        text: '#1e40af',
        icon: 'ℹ',
      };
  }
}

/**
 * Show an in-page toast notification.
 * Creates a DOM-based toast that auto-dismisses after the specified duration.
 */
export function showToast(options: NotificationOptions): void {
  if (typeof document === 'undefined') {
    return;
  }

  const { type, title, message, duration = 5000 } = options;
  const container = getOrCreateToastContainer();
  const colors = getToastColors(type);

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = [
    `background: ${colors.bg}`,
    `border: 1px solid ${colors.border}`,
    `color: ${colors.text}`,
    'border-radius: 8px',
    'padding: 12px 16px',
    'min-width: 280px',
    'max-width: 400px',
    'box-shadow: 0 4px 12px rgba(0,0,0,0.1)',
    'pointer-events: auto',
    'opacity: 0',
    'transform: translateX(100%)',
    'transition: opacity 0.3s ease, transform 0.3s ease',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font-size: 14px',
    'line-height: 1.4',
  ].join(';');

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <span style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">${colors.icon}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; margin-bottom: 2px;">${escapeHtml(title)}</div>
        <div style="opacity: 0.85;">${escapeHtml(message)}</div>
      </div>
      <button
        aria-label="关闭通知"
        style="background: none; border: none; cursor: pointer; font-size: 16px; color: ${colors.text}; opacity: 0.6; padding: 0; line-height: 1; flex-shrink: 0;"
      >×</button>
    </div>
  `;

  container.appendChild(toast);

  // Close button handler
  const closeBtn = toast.querySelector('button');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dismissToast(toast));
  }

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast: HTMLElement): void {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  setTimeout(() => {
    toast.remove();
  }, 300);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Tab Title Flash
// ============================================================

/**
 * Flash the browser tab title to attract user attention.
 * Returns a stop function that restores the original title.
 *
 * @param message - The message to flash in the title
 * @param originalTitle - The original page title to alternate with
 * @returns A function that stops the flashing and restores the original title
 */
export function flashTabTitle(
  message: string,
  originalTitle: string
): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  let isOriginal = true;
  const intervalId = setInterval(() => {
    document.title = isOriginal ? `🔔 ${message}` : originalTitle;
    isOriginal = !isOriginal;
  }, 1000);

  // Stop flashing when user focuses the tab
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      stop();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function stop() {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.title = originalTitle;
  }

  return stop;
}
