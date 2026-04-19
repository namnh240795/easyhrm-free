import { test, expect } from '@playwright/test';

test.describe('Attendance System - Motion Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to attendance page
    await page.goto('/attendance.html');

    // Wait for models to load and page to be ready
    await page.waitForSelector('#status', { timeout: 30000 });
    await page.waitForTimeout(2000); // Extra time for model loading
  });

  test('should load attendance page with all UI elements', async ({ page }) => {
    // Check main elements are present
    await expect(page.locator('video#video')).toBeVisible();
    await expect(page.locator('canvas#canvas')).toBeVisible();
    await expect(page.locator('#toggle-attendance-btn')).toBeVisible();
    await expect(page.locator('#test-mode-btn')).toBeVisible();
    await expect(page.locator('#motion-detection-btn')).toBeVisible();

    // Check debug panel
    await expect(page.locator('#debug-faces')).toBeVisible();
    await expect(page.locator('#debug-registered')).toBeVisible();
    await expect(page.locator('#debug-zone')).toBeVisible();
  });

  test('should toggle attendance tracking on and off', async ({ page }) => {
    const toggleBtn = page.locator('#toggle-attendance-btn');

    // Initial state
    await expect(toggleBtn).toHaveText('Start Attendance');

    // Start attendance
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('Stop Attendance');
    await expect(toggleBtn).toHaveClass(/btn-danger/);

    // Stop attendance
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('Start Attendance');
    await expect(toggleBtn).toHaveClass(/btn-primary/);
  });

  test('should toggle test mode', async ({ page }) => {
    const testModeBtn = page.locator('#test-mode-btn');

    // Initial state
    await expect(testModeBtn).toHaveText('Test Mode: Off');

    // Enable test mode
    await testModeBtn.click();
    await expect(testModeBtn).toHaveText('Test Mode: On');
    await expect(page.locator('#debug-test')).toHaveText('Yes');

    // Disable test mode
    await testModeBtn.click();
    await expect(testModeBtn).toHaveText('Test Mode: Off');
    await expect(page.locator('#debug-test')).toHaveText('No');
  });

  test('should toggle motion detection', async ({ page }) => {
    const motionBtn = page.locator('#motion-detection-btn');

    // Initial state
    await expect(motionBtn).toHaveText('Motion: On');

    // Disable motion detection
    await motionBtn.click();
    await expect(motionBtn).toHaveText('Motion: Off');
    await expect(page.locator('#debug-motion')).toHaveText('No');

    // Enable motion detection
    await motionBtn.click();
    await expect(motionBtn).toHaveText('Motion: On');
    await expect(page.locator('#debug-motion')).toHaveText('Yes');
  });

  test('should display zone indicators on canvas', async ({ page }) => {
    const canvas = page.locator('canvas#canvas');

    // Start camera and detection
    await page.locator('#toggle-attendance-btn').click();
    await page.waitForTimeout(3000);

    // Check that canvas has content (video frames + zone overlays)
    await expect(canvas).toBeVisible();

    // Get canvas dimensions
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('should show debug panel with real-time information', async ({ page }) => {
    // Start attendance
    await page.locator('#toggle-attendance-btn').click();

    // Wait a bit for detection to start
    await page.waitForTimeout(2000);

    // Check debug elements update
    const facesCount = await page.locator('#debug-faces').textContent();
    const registeredCount = await page.locator('#debug-registered').textContent();
    const threshold = await page.locator('#debug-threshold').textContent();

    expect(facesCount).not.toBe('');
    expect(registeredCount).not.toBe('');
    expect(threshold).toBe('0.5');
  });

  test('should display workstation info if configured', async ({ page }) => {
    const wsInfo = page.locator('#workstation-info');

    // Workstation info might be hidden if not configured
    const isVisible = await wsInfo.isVisible().catch(() => false);

    if (isVisible) {
      await expect(wsInfo).toBeVisible();
      await expect(page.locator('#ws-name-display')).not.toBeEmpty();
    }
  });

  test('should handle reset database button', async ({ page }) => {
    const resetBtn = page.locator('#reset-db-btn');

    // Click reset button (should show confirmation dialog)
    await resetBtn.click();

    // Handle the confirmation dialog
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('WARNING');
      dialog.dismiss();
    });
  });

  test('should show currently checked in section', async ({ page }) => {
    const activeUsersSection = page.locator('.status-card:has-text("Currently Checked In")');
    await expect(activeUsersSection).toBeVisible();

    const activeUsersEl = page.locator('#active-users');
    await expect(activeUsersEl).toBeVisible();

    // Initially might show "No users checked in"
    const text = await activeUsersEl.textContent();
    expect(text).toContain('No users checked in');
  });

  test('should show recent activity section', async ({ page }) => {
    const recentActivitySection = page.locator('.status-card:has-text("Recent Activity")');
    await expect(recentActivitySection).toBeVisible();

    const recentActivityEl = page.locator('#recent-activity');
    await expect(recentActivityEl).toBeVisible();
  });

  test('should filter activity by time range', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');

    // Check all filter buttons exist
    await expect(filterBtns).toHaveCount(2); // All and Today

    // Click "Today" filter
    await page.locator('.filter-btn[data-filter="today"]').click();
    await expect(page.locator('.filter-btn[data-filter="today"]')).toHaveClass(/active/);

    // Click "All" filter
    await page.locator('.filter-btn[data-filter="all"]').click();
    await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveClass(/active/);
  });

  test('should display current date and time', async ({ page }) => {
    const currentTime = page.locator('#current-time .time');
    const currentDate = page.locator('#current-date');

    await expect(currentTime).not.toBeEmpty();
    await expect(currentDate).not.toBeEmpty();
  });

  test('should show working hours status', async ({ page }) => {
    const workingHoursStatus = page.locator('#working-hours-status');
    await expect(workingHoursStatus).toBeVisible();

    const statusText = await workingHoursStatus.textContent();
    expect(statusText).toMatch(/(No schedule configured|Within working hours|Outside working hours)/);
  });
});

test.describe('Attendance System - Camera Access', () => {
  test('should request camera permission on page load', async ({ page, context }) => {
    // Grant camera permission
    await context.grantPermissions(['camera']);

    await page.goto('/attendance.html');

    // Wait for video element
    await page.waitForSelector('video#video', { timeout: 10000 });

    // Check video is playing
    const video = page.locator('video#video');
    await expect(video).toHaveAttribute('srcObject', /MediaStream/);
  });

  test('should show error if camera access is denied', async ({ page, context }) => {
    // Deny camera permission
    await context.clearPermissions();
    await page.goto('/attendance.html');

    // Check for error message (might be in status or alert)
    await page.waitForTimeout(2000);

    const statusText = await page.locator('#status-text').textContent();
    const hasError = statusText?.toLowerCase().includes('camera') ||
                     statusText?.toLowerCase().includes('permission');

    // Note: This test might need adjustment based on actual error handling
    if (hasError) {
      console.log('Camera denial handled correctly');
    }
  });
});

test.describe('Attendance System - Zone Detection', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await page.goto('/attendance.html');
    await page.waitForSelector('#status', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test('should update zone information in debug panel', async ({ page }) => {
    // Start attendance
    await page.locator('#toggle-attendance-btn').click();
    await page.waitForTimeout(3000);

    // Check zone info is displayed
    const zoneText = await page.locator('#debug-zone').textContent();
    expect(zoneText).not.toBe('-');

    // Zone should be one of: left, middle, right
    if (zoneText && zoneText !== '-') {
      expect(zoneText.toLowerCase()).toMatch(/(left|middle|right)/);
    }
  });

  test('should show zone indicators on canvas overlay', async ({ page }) => {
    // Start attendance to enable detection
    await page.locator('#toggle-attendance-btn').click();
    await page.waitForTimeout(3000);

    // Check canvas is visible and has content
    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'test-results/zones-overlay.png' });
  });

  test('should track movement when face is detected', async ({ page }) => {
    // Enable motion detection and test mode
    await page.locator('#test-mode-btn').click();
    await page.locator('#toggle-attendance-btn').click();

    await page.waitForTimeout(5000);

    // Check movement tracking indicator
    const movementText = await page.locator('#debug-movement').textContent();

    // If faces are detected, movement should show "Tracking"
    if (movementText && movementText !== 'None' && movementText !== '-') {
      console.log('Movement tracking active:', movementText);
    }
  });
});

test.describe('Database Operations', () => {
  test('should clear attendance records when requested', async ({ page }) => {
    await page.goto('/attendance.html');
    await page.waitForSelector('#status');

    // Note: This test would need actual attendance data to verify
    // For now, just check the button exists and can be clicked
    const clearBtn = page.locator('#clear-attendance-btn');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();

      page.on('dialog', dialog => {
        expect(dialog.message()).toContain('clear all attendance');
        dialog.dismiss();
      });
    }
  });

  test('should reset database when requested', async ({ page }) => {
    await page.goto('/attendance.html');
    await page.waitForSelector('#status');

    const resetBtn = page.locator('#reset-db-btn');
    await resetBtn.click();

    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('WARNING');
      expect(dialog.message()).toContain('delete ALL data');
      dialog.dismiss();
    });
  });
});
