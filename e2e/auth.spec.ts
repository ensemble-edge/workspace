/**
 * Authentication E2E Tests
 *
 * Tests the complete auth flow:
 * - Bootstrap (first user setup)
 * - Login with email/password
 * - Session persistence
 * - Logout
 */

import { test, expect } from '@playwright/test';

// Test user credentials (from seed script)
const TEST_USER = {
  email: 'owner@demo.local',
  password: 'owner123',
};

test.describe('Authentication', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('unauthenticated user sees login or bootstrap page', async ({ page }) => {
    await page.goto('/');

    // Should redirect to either /login or /setup (bootstrap)
    await expect(page).toHaveURL(/\/(login|setup)/);
  });

  test('bootstrap flow creates first user', async ({ page }) => {
    // Check if we're in bootstrap mode (no users yet)
    const response = await page.request.get('/_ensemble/bootstrap/status');
    const data = await response.json();

    if (data.needsBootstrap) {
      // Navigate to setup
      await page.goto('/setup');

      // Fill in the bootstrap form
      await page.fill('[name="email"]', 'newowner@test.local');
      await page.fill('[name="password"]', 'newpassword123');
      await page.fill('[name="confirmPassword"]', 'newpassword123');
      await page.fill('[name="displayName"]', 'Test Owner');

      // Submit
      await page.click('button[type="submit"]');

      // Should redirect to home after bootstrap
      await expect(page).toHaveURL('/');
    } else {
      // Already bootstrapped, skip this test
      test.skip();
    }
  });

  test('login with valid credentials redirects to home', async ({ page }) => {
    await page.goto('/login');

    // Fill in credentials
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to home
    await expect(page).toHaveURL('/');

    // Should see the shell
    await expect(page.locator('#app')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    // Fill in wrong credentials
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', 'wrongpassword');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();

    // Should still be on login page
    await expect(page).toHaveURL('/login');
  });

  test('authenticated user can access protected API', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Now check the /me endpoint
    const response = await page.request.get('/_ensemble/auth/me');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.user.email).toBe(TEST_USER.email);
  });

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', TEST_USER.email);
    await page.fill('[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Logout via API
    await page.request.post('/_ensemble/auth/logout');

    // Refresh and check we're logged out
    await page.goto('/');
    await expect(page).toHaveURL(/\/(login|setup)/);
  });
});

test.describe('Brand API', () => {
  test('theme endpoint returns colors', async ({ request }) => {
    const response = await request.get('/_ensemble/brand/theme');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.colors).toBeDefined();
    expect(data.colors.accent).toBeDefined();
  });

  test('css endpoint returns CSS variables', async ({ request }) => {
    const response = await request.get('/_ensemble/brand/css');
    expect(response.ok()).toBeTruthy();

    const css = await response.text();
    expect(css).toContain(':root');
    expect(css).toContain('--color-accent');
  });
});

test.describe('Workspace API', () => {
  test('workspace endpoint returns workspace info', async ({ request }) => {
    const response = await request.get('/_ensemble/workspace');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.slug).toBe('demo');
    expect(data.name).toBe('Demo Workspace');
  });
});
