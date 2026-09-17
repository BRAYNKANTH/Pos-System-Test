const { chromium } = require('@playwright/test');
const { build } = require('esbuild');
const http = require('node:http');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const bundle = await build({ entryPoints: ['tests/ui-harness.tsx'], bundle: true, write: false, jsx: 'automatic', platform: 'browser', tsconfig: 'tsconfig.json' });
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
    else res.end('<!doctype html><html lang="en"><title>POS tests</title><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const channel = process.env.POS_TEST_BROWSER || (fs.existsSync(chromium.executablePath()) ? undefined : 'msedge');
    browser = await chromium.launch({ headless: true, channel });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: 'Open payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Payment' });
    await dialog.waitFor();
    const qty = page.getByRole('textbox', { name: 'Quantity', exact: true });
    await qty.fill('');
    assert.equal(await page.getByLabel('Committed quantity').textContent(), '2');
    await qty.fill('12'); await qty.press('Enter');
    assert.equal(await page.getByLabel('Committed quantity').textContent(), '12');
    assert.equal(await dialog.isVisible(), true);
    const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
    await amount.fill('250.50'); await amount.press('Tab');
    assert.equal(await page.getByLabel('Committed amount').textContent(), '250.5');
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab');
      // Chromium may cycle through browser chrome (reported as body); background controls stay inert.
      assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('dialog')), true);
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Cancel' }).isDisabled(), true);
    await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true);
    await page.getByRole('button', { name: 'Cancel' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Open payment' }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Open payment' }).click();
    await page.addScriptTag({ content: fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8') });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector('dialog'), { rules: { 'color-contrast': { enabled: false } } })).violations);
    assert.deepEqual(violations.map(v => v.id), []);
    assert.deepEqual(errors, []);
    console.log('PASS: typing, decimal paste, Enter, focus containment/restoration, busy Escape protection, and dialog accessibility');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
