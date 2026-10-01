async (page) => {
  const snap = () => page.evaluate(() => window.__wakppu.snapshot());
  const report = [];
  const started = Date.now();
  async function move(x, z) {
    for (let i = 0; i < 65; i++) {
      const p = (await snap()).player;
      const dx = x - p.x,
        dz = z - p.z;
      if (Math.hypot(dx, dz) < 0.13) return;
      const h = Math.abs(dx) > 0.1,
        key = h ? (dx > 0 ? 'd' : 'a') : dz > 0 ? 's' : 'w';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(190, Math.max(40, (Math.abs(h ? dx : dz) / 3.8) * 1000)));
      await page.keyboard.up(key);
    }
    throw Error('Could not reach ' + x + ',' + z);
  }
  async function crush() {
    let s = await snap();
    if (s.mode !== 'bench') {
      await move(-3.7, -1.4);
      await page.keyboard.press('e');
    } else if (s.done) {
      await page.getByRole('button', { name: '다음 말랑이 →' }).click();
    }
    await page.waitForTimeout(400);
    for (let rot = 0; rot < 12; rot++) {
      if ((await snap()).done) return;
      const p = await page.evaluate(() => window.__wakppu.project(-3.7, 1.9, -2.9));
      const r = (page.viewportSize().height / 5.6) * 0.55;
      for (const [dx, dy] of [
        [0, 0],
        [-0.8, -0.55],
        [0.8, -0.55],
        [0.8, 0.55],
        [-0.8, 0.55],
      ]) {
        await page.mouse.move(p.x + dx * r, p.y + dy * r);
        await page.mouse.down();
        await page.waitForTimeout(290);
        await page.mouse.up();
      }
      await page.waitForTimeout(750);
      if (!(await snap()).done) await page.getByRole('button', { name: '↻ 돌리기' }).click();
    }
    if (!(await snap()).done) throw Error('Crush incomplete');
  }
  async function purchase(key) {
    await page.getByRole('button', { name: '가게 성장' }).click();
    await page.locator('[data-buy="' + key + '"]').click();
    await page.getByRole('button', { name: '계속 놀기' }).click();
    if (!(await snap()).upgrades[key]) throw Error('Purchase failed ' + key);
  }
  for (let i = 0; i < 20; i++) {
    let s = await snap();
    if (s.paused) await page.getByRole('button', { name: '계속 놀기' }).click();
    if (s.coins >= 30 && !s.upgrades.carry) {
      await purchase('carry');
      report.push({ event: 'carry', seconds: (Date.now() - started) / 1000 });
    }
    s = await snap();
    if (s.coins >= 60 && !s.upgrades.runner) {
      await purchase('runner');
      report.push({ event: 'runner', seconds: (Date.now() - started) / 1000 });
    }
    s = await snap();
    if (s.coins >= 90 && !s.upgrades.expansion) {
      await purchase('expansion');
      await page.getByRole('button', { name: '← 매장' }).click();
      await page.waitForTimeout(16000);
      await page.screenshot({ path: 'output/playwright/06-expanded.png' });
      report.push({
        event: 'expanded',
        seconds: (Date.now() - started) / 1000,
        state: await snap(),
      });
      return report;
    }
    await crush();
    s = await snap();
    if (!s.upgrades.runner) {
      await page.getByRole('button', { name: '← 매장' }).click();
      await move(-0.5, -1.4);
      await page.waitForTimeout(450);
      await move(-1, 1.4);
      await page.waitForTimeout(2100);
    } else {
      await page.waitForTimeout(5000);
      if (i === 10) {
        await page.getByRole('button', { name: '← 매장' }).click();
        await page.screenshot({ path: 'output/playwright/07-staff.png' });
      }
    }
    s = await snap();
    report.push({
      event: 'batch',
      made: s.made,
      sold: s.sold,
      coins: s.coins,
      seconds: (Date.now() - started) / 1000,
    });
  }
  return report;
}
