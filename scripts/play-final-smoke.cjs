async page => {
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4174/WAKPPU_Please/');await page.waitForTimeout(400);
 await page.screenshot({path:'output/playwright/01-first.png'});
 await page.keyboard.down('w');await page.waitForTimeout(280);await page.keyboard.up('w');await page.keyboard.press('e');await page.waitForTimeout(550);
 await page.screenshot({path:'output/playwright/02-bench.png'});
 const mode=await page.evaluate(()=>window.__wakppu.snapshot().mode);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.__wakppu.snapshot().paused);await page.keyboard.press('Escape');
 const cleanFailures=[...failed];await page.route('**/assets/*.js',route=>route.abort());await page.reload();await page.waitForTimeout(400);const fallback=await page.getByRole('button',{name:'다시 열기'}).isVisible();await page.unroute('**/assets/*.js');await page.reload();await page.waitForTimeout(500);
 return {mode,paused,errors,networkFailures:cleanFailures,loadFailureFallback:fallback,recovered:await page.evaluate(()=>!!window.__wakppu)};
}
