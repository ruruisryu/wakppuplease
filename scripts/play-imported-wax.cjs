async page => {
  const state = () => page.evaluate(() => window.__wakppu.snapshot())
  const stats = () => page.evaluate(() => window.__wakppu.waxStats())
  const targets = () => page.evaluate(() => window.__wakppu.waxTargets())
  await page.getByRole('button', { name: '누르기', exact: true }).click()
  const p = (await targets())[0]
  if (!p) throw Error('No visible original shell plate')
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(900)
  const held = await stats()
  await page.screenshot({ path: 'output/playwright/imported-press.png' })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const released = await stats()
  const before = await state()
  await page.getByRole('button', { name: '← 매장' }).click()
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('wakppu.please.v1')))
  const savedStats = await stats()
  await page.reload()
  await page.waitForTimeout(350)
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.__wakppu.waxStats().ready)
  const restored = await state(), restoredStats = await stats()
  await page.screenshot({ path: 'output/playwright/imported-restored.png' })
  return { held, released, savedStats, restoredStats, workRestored:Math.abs(before.waxWork-restored.waxWork)<.0001,
    saveBytes:JSON.stringify(save).length, attachedRestored:save.workbench.plates.length===restoredStats.pieces,
    modelLocked:await page.getByRole('combobox',{name:'말랑이 모델'}).isDisabled() }
}

