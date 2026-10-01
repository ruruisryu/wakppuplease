async page => {
 const snap=()=>page.evaluate(()=>window.__wakppu.snapshot());
 if((await snap()).paused)await page.getByRole('button',{name:'계속 놀기'}).click();
 const high=[];for(let i=0;i<3;i++){await page.waitForTimeout(1200);high.push((await snap()).metrics.fps);}
 await page.getByRole('button',{name:'일시정지'}).click();await page.getByLabel('가벼운 그래픽').check();await page.getByRole('button',{name:'계속 놀기'}).click();
 const low=[];for(let i=0;i<3;i++){await page.waitForTimeout(1200);low.push((await snap()).metrics.fps);}
 await page.getByRole('button',{name:'일시정지'}).click();await page.getByLabel('가벼운 그래픽').uncheck();await page.getByRole('button',{name:'계속 놀기'}).click();
 await page.screenshot({path:'output/playwright/06-expanded.png'});
 return {viewport:page.viewportSize(),high,low,metrics:(await snap()).metrics};
}
