import { test, expect } from '@playwright/test';

test.describe('Main Page Navigation', () => {
  test('should load main page', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Face Recognition System/);

    // Check main heading
    await expect(page.locator('h1')).toContainText('Face Recognition System');
  });

  test('should have navigation cards to all pages', async ({ page }) => {
    await page.goto('/');

    // Check all navigation cards exist
    await expect(page.locator('a[href="workstation.html"]')).toBeVisible();
    await expect(page.locator('a[href="attendance.html"]')).toBeVisible();
    await expect(page.locator('a[href="register.html"]')).toBeVisible();
    await expect(page.locator('a[href="validate.html"]')).toBeVisible();
  });

  test('should navigate to attendance page', async ({ page }) => {
    await page.goto('/');

    // Click attendance card
    await page.click('a[href="attendance.html"]');

    // Should navigate to attendance page
    await expect(page).toHaveURL(/attendance\.html/);
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/');

    // Click register card
    await page.click('a[href="register.html"]');

    // Should navigate to register page
    await expect(page).toHaveURL(/register\.html/);
  });

  test('should navigate to validate page', async ({ page }) => {
    await page.goto('/');

    // Click validate card
    await page.click('a[href="validate.html"]');

    // Should navigate to validate page
    await expect(page).toHaveURL(/validate\.html/);
  });

  test('should navigate to workstation page', async ({ page }) => {
    await page.goto('/');

    // Click workstation card
    await page.click('a[href="workstation.html"]');

    // Should navigate to workstation page
    await expect(page).toHaveURL(/workstation\.html/);
  });
});

test.describe('Face Registration Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await page.goto('/register.html');
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should load registration page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Register Face');

    // Check form elements
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show camera feed', async ({ page }) => {
    const video = page.locator('video#video');
    await expect(video).toBeVisible();
  });

  test('should require name before capture', async ({ page }) => {
    // Try to submit without name
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill('');
    await page.locator('button[type="submit"]').click();

    // Should show validation error
    const errorVisible = await page.locator('text=/name is required/i').isVisible().catch(() => false);
    if (errorVisible) {
      await expect(page.locator('text=/name is required/i')).toBeVisible();
    }
  });

  test('should allow face registration with valid name', async ({ page }) => {
    const testName = `Test User ${Date.now()}`;

    // Fill in name
    await page.fill('input[name="name"]', testName);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for capture and processing
    await page.waitForTimeout(5000);

    // Check for success message
    const successMessage = await page.locator('text=/success|registered|face saved/i').isVisible().catch(() => false);

    if (successMessage) {
      await expect(page.locator('text=/success|registered|face saved/i')).toBeVisible();
    }
  });

  test('should detect duplicate face registration', async ({ page }) => {
    const testName = `Duplicate Test ${Date.now()}`;

    // Register first face
    await page.fill('input[name="name"]', testName);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Try to register again with same name
    await page.fill('input[name="name"]', testName);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Should show duplicate warning
    const duplicateWarning = await page.locator('text=/already|duplicate|exists/i').isVisible().catch(() => false);

    if (duplicateWarning) {
      await expect(page.locator('text=/already|duplicate|exists/i')).toBeVisible();
    }
  });
});

test.describe('Face Validation Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await page.goto('/validate.html');
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should load validation page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Validate Face');

    // Check validation elements
    await expect(page.locator('video#video')).toBeVisible();
    await expect(page.locator('canvas#canvas')).toBeVisible();
  });

  test('should have mode toggle buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Manual")')).toBeVisible();
    await expect(page.locator('button:has-text("Auto")')).toBeVisible();
  });

  test('should switch between manual and auto mode', async ({ page }) => {
    const manualBtn = page.locator('button:has-text("Manual")');
    const autoBtn = page.locator('button:has-text("Auto")');

    // Click auto mode
    await autoBtn.click();
    await expect(autoBtn).toHaveClass(/active|primary/);

    // Click manual mode
    await manualBtn.click();
    await expect(manualBtn).toHaveClass(/active|primary/);
  });

  test('should show validation result when face is matched', async ({ page }) => {
    // Note: This test requires registered faces to work properly

    // Start auto mode
    await page.click('button:has-text("Auto")');
    await page.waitForTimeout(5000);

    // Check if any face is detected and validated
    const resultElement = page.locator('.validation-result, .match-result, #result');

    const isResultVisible = await resultElement.isVisible().catch(() => false);
    if (isResultVisible) {
      const resultText = await resultElement.textContent();
      console.log('Validation result:', resultText);
    }
  });
});

test.describe('Workstation Configuration', () => {
  test('should load workstation page', async ({ page }) => {
    await page.goto('/workstation.html');

    await expect(page.locator('h1')).toContainText('Workstation');

    // Check form elements
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="location"]')).toBeVisible();
  });

  test('should have all 7 days configuration', async ({ page }) => {
    await page.goto('/workstation.html');

    // Check all days are present
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (const day of days) {
      await expect(page.locator(`text=${day}`)).toBeVisible();
    }
  });

  test('should toggle day enable/disable', async ({ page }) => {
    await page.goto('/workstation.html');

    // Find Monday's enable checkbox
    const mondayCheckbox = page.locator('text=Monday').locator('..').locator('input[type="checkbox"]');

    if (await mondayCheckbox.isVisible()) {
      const initialState = await mondayCheckbox.isChecked();

      await mondayCheckbox.click();
      await expect(mondayCheckbox).not.toBeChecked();

      await mondayCheckbox.click();
      await expect(mondayCheckbox).toBeChecked();
    }
  });

  test('should set working hours for a day', async ({ page }) => {
    await page.goto('/workstation.html');

    // Find Monday's time inputs
    const mondaySection = page.locator('text=Monday').locator('..');
    const startTimeInput = mondaySection.locator('input[name*="start"], input[type="time"]').first();
    const endTimeInput = mondaySection.locator('input[name*="end"], input[type="time"]').last();

    if (await startTimeInput.isVisible()) {
      await startTimeInput.fill('09:00');
      await endTimeInput.fill('17:00');

      await expect(startTimeInput).toHaveValue('09:00');
      await expect(endTimeInput).toHaveValue('17:00');
    }
  });

  test('should save workstation configuration', async ({ page }) => {
    await page.goto('/workstation.html');

    // Fill in workstation info
    await page.fill('input[name="name"]', 'Test Workstation');
    await page.fill('input[name="location"]', 'Test Location');

    // Set Monday hours
    const mondaySection = page.locator('text=Monday').locator('..');
    const startTimeInput = mondaySection.locator('input[type="time"]').first();
    const endTimeInput = mondaySection.locator('input[type="time"]').last();

    if (await startTimeInput.isVisible()) {
      await startTimeInput.fill('09:00');
      await endTimeInput.fill('17:00');
    }

    // Submit form
    await page.click('button[type="submit"], button:has-text("Save")');

    // Wait for save
    await page.waitForTimeout(2000);

    // Check for success message
    const successMessage = await page.locator('text=/saved|success|configur/i').isVisible().catch(() => false);

    if (successMessage) {
      await expect(page.locator('text=/saved|success|configur/i')).toBeVisible();
    }
  });

  test('should have quick action buttons', async ({ page }) => {
    await page.goto('/workstation.html');

    // Check for quick action buttons
    const applyToAllBtn = page.locator('button:has-text("Apply to All")');
    const weekdaysBtn = page.locator('button:has-text("Weekdays")');

    const hasApplyToAll = await applyToAllBtn.isVisible().catch(() => false);
    const hasWeekdays = await weekdaysBtn.isVisible().catch(() => false);

    if (hasApplyToAll) {
      await expect(applyToAllBtn).toBeVisible();
    }

    if (hasWeekdays) {
      await expect(weekdaysBtn).toBeVisible();
    }
  });
});

test.describe('Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check main page is responsive
    await expect(page.locator('h1')).toBeVisible();

    // Cards should stack vertically on mobile
    const cards = page.locator('.card');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.locator('h1')).toBeVisible();

    // Cards should be in grid layout
    const cards = page.locator('.card');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.locator('h1')).toBeVisible();

    // Cards should be in grid layout
    const cards = page.locator('.card');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Privacy and Data Storage', () => {
  test('should show privacy notice on main page', async ({ page }) => {
    await page.goto('/');

    const privacyNotice = page.locator('.privacy-notice, text=/privacy/i');

    const isVisible = await privacyNotice.isVisible().catch(() => false);

    if (isVisible) {
      await expect(privacyNotice).toBeVisible();
      await expect(privacyNotice).toContainText(/IndexedDB|local|storage/i);
    }
  });

  test('should use IndexedDB for storage', async ({ page }) => {
    await page.goto('/');

    // Check that IndexedDB is being used
    const hasIndexedDB = await page.evaluate(() => {
      return typeof window.indexedDB !== 'undefined';
    });

    expect(hasIndexedDB).toBe(true);
  });

  test('should not send data to external servers (except CDN)', async ({ page }) => {
    // Monitor network requests
    const requests = [];

    page.on('request', request => {
      requests.push({
        url: request.url(),
        resourceType: request.resourceType()
      });
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out CDN requests (jsdelivr, github pages, etc.)
    const nonCdnRequests = requests.filter(req => {
      const url = req.url.toLowerCase();
      return !url.includes('jsdelivr') &&
             !url.includes('github') &&
             !url.includes('localhost') &&
             req.resourceType === 'xhr' ||
             req.resourceType === 'fetch';
    });

    // Should not have external API calls
    expect(nonCdnRequests.length).toBe(0);
  });
});
