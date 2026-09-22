import { test, expect } from '@playwright/test';

test.describe('VitaliaGym System & Status Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[name="email"]').fill('test_fresh@admin.com');
    await page.locator('input[name="password"]').fill('test123');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('should display clients table and verify status badges', async ({ page }) => {
    await page.goto('/clientes');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // Wait for table data to load
    await page.waitForSelector('tbody tr', { timeout: 15000 });

    // Look for a client that has "Pendiente" status
    const pendienteBadge = page.locator('text=Pendiente').first();
    await expect(pendienteBadge).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to payments table and verify columns and headers', async ({ page }) => {
    await page.goto('/pagos');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // Verify key columns
    await expect(page.getByText('Cliente').first()).toBeVisible();
    await expect(page.getByText('USD').first()).toBeVisible();
    await expect(page.getByText('Restante').first()).toBeVisible();
  });
});
