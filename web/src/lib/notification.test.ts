/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendDesktopNotification,
  requestNotificationPermission,
  showToast,
  flashTabTitle,
} from './notification';

describe('Notification Service', () => {
  describe('sendDesktopNotification', () => {
    beforeEach(() => {
      // Mock the Notification API
      const MockNotification = vi.fn() as unknown as typeof Notification;
      Object.defineProperty(MockNotification, 'permission', {
        value: 'granted',
        writable: true,
        configurable: true,
      });
      MockNotification.requestPermission = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(window, 'Notification', {
        value: MockNotification,
        writable: true,
        configurable: true,
      });
    });

    it('should create a Notification when permission is granted', () => {
      sendDesktopNotification('Test Title', 'Test Body');
      expect(window.Notification).toHaveBeenCalledWith('Test Title', {
        body: 'Test Body',
      });
    });

    it('should not create a Notification when permission is denied', () => {
      Object.defineProperty(window.Notification, 'permission', {
        value: 'denied',
        configurable: true,
      });
      sendDesktopNotification('Test Title', 'Test Body');
      // Notification constructor should not be called (only the permission check)
      expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should not throw when Notification API is unavailable', () => {
      // @ts-expect-error - intentionally removing Notification for test
      delete (window as Record<string, unknown>).Notification;
      expect(() =>
        sendDesktopNotification('Test', 'Body')
      ).not.toThrow();
    });
  });

  describe('requestNotificationPermission', () => {
    it('should return true when permission is already granted', async () => {
      const MockNotification = vi.fn() as unknown as typeof Notification;
      Object.defineProperty(MockNotification, 'permission', {
        value: 'granted',
        configurable: true,
      });
      MockNotification.requestPermission = vi.fn();
      Object.defineProperty(window, 'Notification', {
        value: MockNotification,
        writable: true,
        configurable: true,
      });

      const result = await requestNotificationPermission();
      expect(result).toBe(true);
      expect(MockNotification.requestPermission).not.toHaveBeenCalled();
    });

    it('should return false when permission is denied', async () => {
      const MockNotification = vi.fn() as unknown as typeof Notification;
      Object.defineProperty(MockNotification, 'permission', {
        value: 'denied',
        configurable: true,
      });
      MockNotification.requestPermission = vi.fn();
      Object.defineProperty(window, 'Notification', {
        value: MockNotification,
        writable: true,
        configurable: true,
      });

      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });

    it('should request permission when status is default', async () => {
      const MockNotification = vi.fn() as unknown as typeof Notification;
      Object.defineProperty(MockNotification, 'permission', {
        value: 'default',
        configurable: true,
      });
      MockNotification.requestPermission = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(window, 'Notification', {
        value: MockNotification,
        writable: true,
        configurable: true,
      });

      const result = await requestNotificationPermission();
      expect(result).toBe(true);
      expect(MockNotification.requestPermission).toHaveBeenCalled();
    });

    it('should return false when Notification API is unavailable', async () => {
      // @ts-expect-error - intentionally removing Notification for test
      delete (window as Record<string, unknown>).Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });
  });

  describe('showToast', () => {
    beforeEach(() => {
      // Clean up any existing toast containers
      const existing = document.getElementById('notification-toast-container');
      if (existing) existing.remove();
    });

    afterEach(() => {
      const existing = document.getElementById('notification-toast-container');
      if (existing) existing.remove();
    });

    it('should create a toast container if none exists', () => {
      showToast({ type: 'info', title: 'Test', message: 'Hello' });
      const container = document.getElementById('notification-toast-container');
      expect(container).not.toBeNull();
    });

    it('should reuse existing toast container', () => {
      showToast({ type: 'info', title: 'Test 1', message: 'Hello 1' });
      showToast({ type: 'info', title: 'Test 2', message: 'Hello 2' });
      const containers = document.querySelectorAll(
        '#notification-toast-container'
      );
      expect(containers.length).toBe(1);
    });

    it('should create a toast element with correct role for accessibility', () => {
      showToast({ type: 'success', title: 'Done', message: 'Task complete' });
      const container = document.getElementById('notification-toast-container');
      const toast = container?.querySelector('[role="alert"]');
      expect(toast).not.toBeNull();
    });

    it('should display the title and message', () => {
      showToast({ type: 'error', title: 'Error Title', message: 'Error Message' });
      const container = document.getElementById('notification-toast-container');
      expect(container?.textContent).toContain('Error Title');
      expect(container?.textContent).toContain('Error Message');
    });

    it('should auto-dismiss after duration', () => {
      vi.useFakeTimers();
      showToast({ type: 'info', title: 'Test', message: 'Hello', duration: 1000 });
      const container = document.getElementById('notification-toast-container');
      expect(container?.children.length).toBe(1);

      // After duration + transition time
      vi.advanceTimersByTime(1300);
      expect(container?.children.length).toBe(0);
      vi.useRealTimers();
    });

    it('should use default duration of 5000ms', () => {
      vi.useFakeTimers();
      showToast({ type: 'info', title: 'Test', message: 'Hello' });
      const container = document.getElementById('notification-toast-container');

      // Should still be visible before 5000ms
      vi.advanceTimersByTime(4900);
      expect(container?.children.length).toBe(1);

      // Should be dismissed after 5000ms + transition
      vi.advanceTimersByTime(400);
      expect(container?.children.length).toBe(0);
      vi.useRealTimers();
    });

    it('should dismiss when close button is clicked', () => {
      vi.useFakeTimers();
      showToast({ type: 'info', title: 'Test', message: 'Hello', duration: 0 });
      const container = document.getElementById('notification-toast-container');
      const closeBtn = container?.querySelector('button');
      expect(closeBtn).not.toBeNull();

      closeBtn?.click();
      vi.advanceTimersByTime(300);
      expect(container?.children.length).toBe(0);
      vi.useRealTimers();
    });

    it('should apply success styling', () => {
      showToast({ type: 'success', title: 'OK', message: 'Done' });
      const container = document.getElementById('notification-toast-container');
      const toast = container?.firstElementChild as HTMLElement;
      expect(toast?.style.background).toBe('rgb(240, 253, 244)');
    });

    it('should apply error styling', () => {
      showToast({ type: 'error', title: 'Fail', message: 'Oops' });
      const container = document.getElementById('notification-toast-container');
      const toast = container?.firstElementChild as HTMLElement;
      expect(toast?.style.background).toBe('rgb(254, 242, 242)');
    });

    it('should escape HTML in title and message', () => {
      showToast({
        type: 'info',
        title: '<script>alert("xss")</script>',
        message: '<img src=x onerror="hack">',
      });
      const container = document.getElementById('notification-toast-container');
      // The raw script tag should not be present (it should be escaped)
      expect(container?.innerHTML).not.toContain('<script>');
      // The img tag should not be rendered as an actual element
      const imgs = container?.querySelectorAll('img');
      expect(imgs?.length ?? 0).toBe(0);
      // The escaped content should be present
      expect(container?.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('flashTabTitle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      document.title = 'Original Title';
    });

    afterEach(() => {
      vi.useRealTimers();
      document.title = '';
    });

    it('should alternate the tab title with the message', () => {
      flashTabTitle('New Report!', 'Original Title');

      vi.advanceTimersByTime(1000);
      expect(document.title).toBe('🔔 New Report!');

      vi.advanceTimersByTime(1000);
      expect(document.title).toBe('Original Title');

      vi.advanceTimersByTime(1000);
      expect(document.title).toBe('🔔 New Report!');
    });

    it('should return a stop function that restores the original title', () => {
      const stop = flashTabTitle('Alert!', 'My Page');

      vi.advanceTimersByTime(1000);
      expect(document.title).toBe('🔔 Alert!');

      stop();
      expect(document.title).toBe('My Page');

      // Should not change after stopping
      vi.advanceTimersByTime(2000);
      expect(document.title).toBe('My Page');
    });

    it('should stop flashing when tab becomes visible', () => {
      flashTabTitle('Done!', 'Dashboard');

      vi.advanceTimersByTime(1000);
      expect(document.title).toBe('🔔 Done!');

      // Simulate tab becoming visible
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(document.title).toBe('Dashboard');

      // Should not change after visibility change
      vi.advanceTimersByTime(2000);
      expect(document.title).toBe('Dashboard');
    });
  });
});
