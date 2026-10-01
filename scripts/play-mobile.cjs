async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, y, id = 0]) => ({ x, y, id, radiusX: 5, radiusY: 5, force: 1 })),
    });
  const tap = async (locator) => {
    const b = await locator.boundingBox();
    await send('touchStart', [[b.x + b.width / 2, b.y + b.height / 2]]);
    await send('touchEnd', []);
  };
  const snap = () => page.evaluate(() => window.__wakppu.snapshot());
  await page.screenshot({ path: 'output/playwright/08-mobile-first.png' });
  const joy = await page.locator('#joystick').boundingBox();
  const x = joy.x + joy.width / 2,
    y = joy.y + joy.height / 2;
  await send('touchStart', [[x, y]]);
  await send('touchMove', [[x, y - 38]]);
  await page.waitForTimeout(470);
  await send('touchEnd', []);
  const moved = (await snap()).player.z;
  await tap(page.getByRole('button', { name: 'E · 개봉하기' }));
  await page.waitForTimeout(700);
  const p = await page.evaluate(() => window.__wakppu.project(-3.7, 1.9, -2.9));
  await send('touchStart', [[p.x, p.y]]);
  await page.waitForTimeout(550);
  await send('touchMove', [[p.x + 28, p.y + 18]]);
  await page.waitForTimeout(350);
  await send('touchEnd', []);
  const progress = (await snap()).progress;
  await page.screenshot({ path: 'output/playwright/09-mobile-crush.png' });
  // A canceled touch must never remain pressed.
  await send('touchStart', [[p.x - 30, p.y]]);
  await send('touchCancel', []);
  const before = (await snap()).wax;
  await page.waitForTimeout(600);
  const after = (await snap()).wax;
  await tap(page.getByRole('button', { name: '← 매장' }));
  await tap(page.getByRole('button', { name: '일시정지' }));
  const pausedBefore = (await snap()).player;
  await send('touchStart', [[x, y]]);
  await send('touchMove', [[x + 35, y]]);
  await page.waitForTimeout(250);
  await send('touchEnd', []);
  const pausedAfter = (await snap()).player;
  await page.getByLabel('소리 끄기').check();
  await tap(page.getByRole('button', { name: '계속 놀기' }));
  await page.reload();
  await page.waitForTimeout(700);
  const restored = await snap();
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/10-mobile-landscape.png' });
  return {
    moved,
    progress,
    touchCancelStopped: JSON.stringify(before) === JSON.stringify(after),
    pausedInputBlocked: JSON.stringify(pausedBefore) === JSON.stringify(pausedAfter),
    mutedRestored: restored.settings.muted,
    waxRestored: restored.wax.some((v) => v > 0),
    scroll: await page.evaluate(() => ({
      w: innerWidth,
      h: innerHeight,
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
    })),
  };
}
