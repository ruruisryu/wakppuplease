async (page) => {
  const snap = () => page.evaluate(() => window.__wakppu.snapshot());
  if ((await snap()).mode === 'bench') await page.getByRole('button', { name: '← 매장' }).click();
  async function move(x, z) {
    for (let i = 0; i < 50; i++) {
      const s = await snap(),
        p = s.player;
      const dx = x - p.x,
        dz = z - p.z;
      if (Math.hypot(dx, dz) < 0.12) break;
      const horizontal = Math.abs(dx) > 0.1;
      const key = horizontal ? (dx > 0 ? 'd' : 'a') : dz > 0 ? 's' : 'w';
      await page.keyboard.down(key);
      await page.waitForTimeout(
        Math.min(180, Math.max(40, (Math.abs(horizontal ? dx : dz) / 3.8) * 1000)),
      );
      await page.keyboard.up(key);
    }
  }
  await move(-0.5, -1.4);
  await page.waitForTimeout(850);
  const carried = (await snap()).carried;
  await page.screenshot({ path: 'output/playwright/04-carry.png' });
  await move(-1, 1.4);
  await page.waitForTimeout(2800);
  const s = await snap();
  await page.screenshot({ path: 'output/playwright/05-first-sale.png' });
  return { carried, sold: s.sold, coins: s.coins, shelf: s.shelf, player: s.player };
}

