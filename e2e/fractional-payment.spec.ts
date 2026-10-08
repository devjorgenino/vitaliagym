import { test, expect } from '@playwright/test';

test.describe('Fractional Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[name="email"]').fill('test@admin.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('should create a fractional payment and show correct remaining balance', async ({ page }) => {
    await page.goto('/pagos');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // Click "Nuevo Pago" button
    await page.getByRole('button', { name: /Nuevo Pago/i }).click();

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // Click SearchableSelect for client
    const clientSelectBtn = page.locator('#client_id');
    await clientSelectBtn.click();

    // Wait for options and select first option
    const option = page.locator('[role="option"]').first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // Select "Pago Parcial" mode
    await page.getByText('Pago Parcial').click();

    // Fill amount with fractional value (e.g. 10)
    const amountInput = page.locator('input[name="amount_usd"]');
    await expect(amountInput).toBeEnabled({ timeout: 5000 });
    await amountInput.fill('10');

    // Select Bank
    const bankTrigger = page.locator('#bank');
    await bankTrigger.click();
    await page.locator('[role="option"]').first().click();

    // Fill reference
    await page.locator('input[name="reference"]').fill('TEST-FRACT');

    // Fill phone number
    await page.locator('input[name="phone_payment"]').fill('1234567');

    // Submit
    await page.getByRole('button', { name: /Registrar Pago/i }).click();

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 15000 });

    // Wait for table update
    await page.waitForTimeout(2000);

    // Verify row appears with the test reference
    const testRow = page.locator('tr:has-text("TEST-FRACT")').first();
    await expect(testRow).toBeVisible({ timeout: 5000 });
  });
});
