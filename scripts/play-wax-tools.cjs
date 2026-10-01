async (page) => {
  const snap = () => page.evaluate(() => window.__wakppu.snapshot()),
    stats = () => page.evaluate(() => window.__wakppu.waxStats())
  async function move(x, z) {
    for (let i = 0; i < 50; i++) {
      const p = (await snap()).player,
        dx = x - p.x,
        dz = z - p.z
      if (Math.hypot(dx, dz) < 0.15) return
      const h = Math.abs(dx) > 0.1,
        key = h ? (dx > 0 ? 'd' : 'a') : dz > 0 ? 's' : 'w'
      await page.keyboard.down(key)
      await page.waitForTimeout(Math.min(160, (Math.abs(h ? dx : dz) / 3.8) * 1000))
      await page.keyboard.up(key)
    }
  }
  if ((await snap()).mode !== 'bench') {
    await move(-3.7, -1.4)
    await page.keyboard.press('e')
  }
  await page.waitForFunction(() => window.__wakppu.waxStats().ready)
  const models = []
  if ((await stats()).coating !== 'classic') {
    for(let i=0;i<2;i++) { if((await stats()).coating==='classic')break;await page.locator('#coating').click() }
  }
  if ((await stats()).wide) await page.locator('#tool').click()
  for (const id of ['Butter', 'Chocolate', 'Corn', 'CrunchMango', 'JumboCheese', 'Peach']) {
    await page.getByRole('combobox', { name: '말랑이 모델' }).selectOption(id)
    await page.waitForFunction(
      (id) => window.__wakppu.waxStats().ready && window.__wakppu.waxStats().id === id,
      id,
    )
    models.push((await stats()).id)
  }
  await page.getByRole('button', { name: '기본 코팅', exact: true }).click()
  await page.getByRole('button', { name: '손끝', exact: true }).click()
  const configured = await stats()
  const p = (await page.evaluate(() => window.__wakppu.waxTargets()))[0]
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(1100)
  await page.screenshot({ path: 'output/playwright/imported-peach.png' })
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '돌리기', exact: true }).click()
  await page.mouse.move(720, 500)
  await page.mouse.down()
  await page.mouse.move(875, 555, { steps: 8 })
  await page.mouse.up()
  const before = (await stats()).peeled
  await page.getByRole('button', { name: '쓸기', exact: true }).click()
  for (let i = 0; i < 12; i++) {
    const targets = await page.evaluate(() => window.__wakppu.waxTargets())
    const p = targets.find((p) => p.sweepable)
    if (!p) break
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.move(p.x + 2, p.y + 1)
    await page.mouse.up()
  }
  const swept = await stats()
  await page.getByRole('button', { name: '파편 정리', exact: true }).click()
  const cleared = await stats()
  await page.getByRole('button', { name: '← 매장' }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wakppu.please.v1')))
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.__wakppu.waxStats().ready)
  await page.screenshot({ path: 'output/playwright/imported-tools.png' })
  return {
    models,
    configured,
    sweepRemoved: swept.peeled > before,
    swept,
    looseAfterClear: cleared.loose,
    poseSaved: saved.workbench.quaternion.some((v, i) => Math.abs(v - [0, 0, 0, 1][i]) > 0.01),
    restored: await stats(),
    metrics: (await snap()).metrics,
  }
}


