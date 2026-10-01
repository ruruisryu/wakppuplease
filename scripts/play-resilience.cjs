async (page) => {
  const snap = () => page.evaluate(() => window.__wakppu.snapshot());
  const report = {};
  await page.getByRole('button', { name: '일시정지' }).click();
  await page.getByRole('button', { name: '새 공방 시작하기' }).click();
  await page.getByRole('button', { name: '초기화하고 시작' }).click();
  let s = await snap();
  report.reset = s.made === 0 && s.coins === 0 && s.wax.every((x) => x === 0);
  await page.keyboard.down('w');
  await page.waitForTimeout(1000);
  await page.keyboard.up('w');
  s = await snap();
  report.facilityCollision = s.player.z > -1.9 && s.player.z < -0.5;
  await page.keyboard.down('s');
  await page.waitForTimeout(600);
  await page.keyboard.up('s');
  await page.keyboard.down('a');
  await page.waitForTimeout(2000);
  await page.keyboard.up('a');
  s = await snap();
  report.wallCollision = s.player.x > -6.4 && s.player.x < -5;
  await page.keyboard.press('Escape');
  const before = await snap();
  await page.waitForTimeout(800);
  const after = await snap();
  report.pauseStopsSimulation =
    before.arrival === after.arrival &&
    JSON.stringify(before.player) === JSON.stringify(after.player);
  await page.keyboard.press('Escape');
  const failures = [],
    errors = [];
  page.on('requestfailed', (r) => failures.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(r.url() + ':' + r.status());
  });
  // Isolated invalid-save fixture: do not mix with the earned progression session.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('corrupt-once')) {
      localStorage.setItem('wakppu.please.v1', '{"version":900}');
      sessionStorage.setItem('corrupt-once', '1');
    }
  });
  await page.reload();
  await page.waitForTimeout(650);
  report.corruptRecovered =
    (await snap()).coins === 0 &&
    (await page.getByRole('status').innerText()) ===
      '저장 데이터를 읽지 못해 새 공방으로 복구했어요';
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => ({ name: r.name, size: r.transferSize })),
  );
  report.errors = errors;
  report.networkFailures = failures;
  report.resources = resources;
  return report;
}
