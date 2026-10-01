async (page) => {
  const snap = () => page.evaluate(() => window.__wakppu.snapshot());
  let s = await snap();
  if (s.paused) await page.getByRole('button', { name: '계속 놀기' }).click();
  if (s.mode !== 'bench') await page.keyboard.press('e');
  await page.waitForTimeout(600);
  const started = Date.now();
  for (let rotation = 0; rotation < 10; rotation++) {
    s = await snap();
    if (s.done) break;
    const p = await page.evaluate(() => window.__wakppu.project(-3.7, 1.9, -2.9));
    const size = page.viewportSize();
    const r = (size.height / 5.6) * 0.55;
    for (const [dx, dy] of [
      [0, 0],
      [-0.8, -0.55],
      [0.8, -0.55],
      [0.8, 0.55],
      [-0.8, 0.55],
      [0, 0],
    ]) {
      await page.mouse.move(p.x + dx * r, p.y + dy * r);
      await page.mouse.down();
      await page.waitForTimeout(320);
      await page.mouse.up();
    }
    await page.waitForTimeout(160);
    if (!(await snap()).done) await page.getByRole('button', { name: '↻ 돌리기' }).click();
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'output/playwright/03-crushed.png' });
  s = await snap();
  return {
    seconds: (Date.now() - started) / 1000,
    progress: s.progress,
    done: s.done,
    made: s.made,
    tray: s.tray,
    coins: s.coins,
    metrics: s.metrics,
  };
}
