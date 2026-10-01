async page => {
  const snap=()=>page.evaluate(()=>window.__wakppu.snapshot())
  let s=await snap()
  if(s.paused)await page.getByRole('button',{name:'계속 놀기'}).click()
  if(s.mode!=='bench')await page.keyboard.press('e')
  await page.waitForFunction(()=>window.__wakppu.waxStats().ready)
  await page.getByRole('button',{name:'누르기',exact:true}).click()
  const started=Date.now()
  for(let i=0;i<40;i++){
    if((await snap()).done)break
    const p=(await page.evaluate(()=>window.__wakppu.waxTargets()))[0]
    if(p){await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(1200);await page.mouse.up()}
    await page.waitForTimeout(800)
    if(i%4===3||!p){const {width,height}=page.viewportSize();await page.mouse.move(width/2,height/2);await page.mouse.down({button:'right'});await page.mouse.move(width/2+170,height/2+60,{steps:6});await page.mouse.up({button:'right'})}
  }
  await page.waitForTimeout(700)
  await page.screenshot({path:'output/playwright/imported-complete.png'})
  s=await snap()
  return {seconds:(Date.now()-started)/1000,progress:s.progress,done:s.done,made:s.made,tray:s.tray,coins:s.coins,metrics:s.metrics,wax:await page.evaluate(()=>window.__wakppu.waxStats())}
}

