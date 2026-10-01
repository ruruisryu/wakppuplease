async page => {
 await page.reload();await page.waitForTimeout(700);
 const snap=()=>page.evaluate(()=>window.__wakppu.snapshot());
 await page.getByRole('button',{name:'일시정지'}).click();const before=await snap();
 await page.reload();await page.waitForTimeout(400);const after=await snap();
 await page.screenshot({path:'output/playwright/06-expanded.png'});
 const report={coinsRestored:before.coins===after.coins,upgradesRestored:JSON.stringify(before.upgrades)===JSON.stringify(after.upgrades),coins:after.coins,upgrades:after.upgrades};
 await page.getByRole('button',{name:'일시정지'}).click();
 return report;
}

