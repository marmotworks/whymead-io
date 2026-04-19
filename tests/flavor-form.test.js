const { strictEqual, ok } = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE = join(__dirname, '..');
const html = readFileSync(join(BASE, 'public', 'limited-edition.html'), 'utf8');
const lambdaCode = readFileSync(join(BASE, 'infra', 'lambda', 'flavor_request_handler.py'), 'utf8');

let failures = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failures++;
    }
}

// Find an opening tag with specific id attribute, return the full tag string
function findTagById(tagName, id) {
    const re = new RegExp(`<${tagName}\\s[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>`, 'i');
    const m = html.match(re);
    return m ? m[0] : null;
}

// Get the type attribute of an input with a given id
function getInputType(id) {
    const tag = findTagById('input', id);
    if (!tag) return null;
    const m = tag.match(/\btype\s*=\s*["']([^"']*)["']/i);
    return m ? m[1] : null;
}

// Check if an input with given id has the required attribute
function hasRequiredForInput(id) {
    const tag = findTagById('input', id);
    if (!tag) return false;
    return /\brequired\b/.test(tag);
}

// Get the text content of a label with a given for attribute
function getLabelText(forId) {
    const re = new RegExp(`<label\\s[^>]*\\bfor\\s*=\\s*["']${forId}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i');
    const m = html.match(re);
    return m ? m[1].trim() : null;
}

// Get the placeholder attribute of an element with given id
function getPlaceholder(tagName, id) {
    const tag = findTagById(tagName, id);
    if (!tag) return null;
    const m = tag.match(/\bplaceholder\s*=\s*["']([^"']*)["']/i);
    return m ? m[1] : null;
}

// Get the full inner text content of a div with given id (handles nested divs)
function getDivTextContent(id) {
    const re = new RegExp(`<div\\s[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>`, 'i');
    const m = html.match(re);
    if (!m) return null;
    const startIdx = m.index + m[0].length;
    // Count nesting depth to find the correct closing </div>
    let depth = 1;
    let i = startIdx;
    while (depth > 0 && i < html.length) {
        const open = html.indexOf('<div', i);
        const close = html.indexOf('</div', i);
        if (close === -1) break;
        if (open !== -1 && open < close) {
            depth++;
            i = open + 4;
        } else {
            depth--;
            if (depth === 0) {
                const inner = html.substring(startIdx, close);
                return inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            }
            i = close + 5;
        }
    }
    return null;
}

// Check if a tag with given id has a specific attribute
function hasAttrForId(tagName, attrName, id) {
    const tag = findTagById(tagName, id);
    if (!tag) return false;
    return new RegExp(`\\b${attrName}\\b`).test(tag);
}

// ── Test Suites ──────────────────────────────────────────────────────────────

console.log('\nForm Structure Tests');
console.log('─────────────────────────────────────────────');

runTest('Form element exists with id "flavorForm"', () => {
    ok(findTagById('form', 'flavorForm'), 'Form with id="flavorForm" not found');
});

runTest('Flavor field is a text input with id="flavor"', () => {
    strictEqual(getInputType('flavor'), 'text', 'Flavor field should be type="text"');
    ok(findTagById('input', 'flavor'), 'Flavor field with id="flavor" not found');
});

runTest('Flavor field has required attribute', () => {
    ok(hasRequiredForInput('flavor'), 'Flavor field missing required attribute');
});

runTest('Name field is a text input with required attribute', () => {
    strictEqual(getInputType('name'), 'text', 'Name field should be type="text"');
    ok(hasRequiredForInput('name'), 'Name field missing required attribute');
});

runTest('Email field is an email input with required attribute', () => {
    strictEqual(getInputType('email'), 'email', 'Email field should be type="email"');
    ok(hasRequiredForInput('email'), 'Email field missing required attribute');
});

runTest('Notes field is a textarea with id="notes" (optional)', () => {
    ok(findTagById('textarea', 'notes'), 'Notes field with id="notes" not found');
    ok(!hasAttrForId('textarea', 'required', 'notes'), 'Notes field should not have required attribute');
});

runTest('Each input has a corresponding label with for attribute', () => {
    const fields = ['flavor', 'name', 'email', 'notes'];
    for (const field of fields) {
        const labelTag = findTagById('label', field);
        // Labels use `for` attribute, not `id`, so check for `for="field"` in any label
        const re = new RegExp(`<label\\s[^>]*\\bfor\\s*=\\s*["']${field}["']`, 'i');
        ok(re.test(html), `No label with for="${field}" found`);
    }
});

runTest('Flavor label contains "Flavor" text', () => {
    const text = getLabelText('flavor');
    ok(text && text.toLowerCase().includes('flavor'), `Flavor label should contain "Flavor" text, got: ${text}`);
});

runTest('Name label contains "Name" text', () => {
    const text = getLabelText('name');
    ok(text && text.toLowerCase().includes('name'), `Name label should contain "Name" text, got: ${text}`);
});

runTest('Email label contains "Email" text', () => {
    const text = getLabelText('email');
    ok(text && text.toLowerCase().includes('email'), `Email label should contain "Email" text, got: ${text}`);
});

runTest('Submit button exists with id="submitBtn" and type="submit"', () => {
    const tag = findTagById('button', 'submitBtn');
    ok(tag, 'Submit button with id="submitBtn" not found');
    ok(/\btype\s*=\s*["']submit["']/.test(tag), 'Submit button should have type="submit"');
});

runTest('Success message element exists with id="formSuccess"', () => {
    ok(findTagById('div', 'formSuccess'), 'Success message div with id="formSuccess" not found');
});

runTest('Success message is hidden by default (CSS display: none)', () => {
    const cssMatch = html.match(/\.form-success\s*\{[^}]*display:\s*none[^}]*\}/);
    ok(cssMatch, 'CSS should set .form-success to display: none');
});

runTest('Success message shows via .show class (display: block)', () => {
    const cssMatch = html.match(/\.form-success\.show\s*\{[^}]*display:\s*block[^}]*\}/);
    ok(cssMatch, 'CSS should set .form-success.show to display: block');
});

runTest('Form submits to /api/flavor-request via POST', () => {
    ok(html.includes('/api/flavor-request'), 'Form should POST to /api/flavor-request');
    ok(html.includes("'POST'") || html.includes('"POST"'), 'Request method should be POST');
});

runTest('Form sends JSON body with Content-Type header', () => {
    ok(html.includes("'application/json'") || html.includes('"application/json"'),
       'Request should set Content-Type to application/json');
});

runTest('Submit button disabled and shows "Sending..." during submission', () => {
    ok(html.includes('submitBtn.disabled = true'), 'Submit button should be disabled during submission');
    ok(html.includes('Sending'), 'Submit button text should change during submission');
});

runTest('Submit button re-enables on error with original text', () => {
    ok(html.includes('submitBtn.disabled = false'), 'Submit button should re-enable on error');
    ok(html.includes('Submit Flavor Request'), 'Submit button should restore original text');
});

runTest('Error alert provides fallback email (hello@whymead.io)', () => {
    ok(html.includes('hello@whymead.io'), 'Error message should include fallback email');
});

runTest('Form data object includes all four fields', () => {
    ok(html.includes("'flavor'") && html.includes("document.getElementById('flavor')"), 'Should read flavor');
    ok(html.includes("'name'") && html.includes("document.getElementById('name')"), 'Should read name');
    ok(html.includes("'email'") && html.includes("document.getElementById('email')"), 'Should read email');
    ok(html.includes("'notes'") && html.includes("document.getElementById('notes')"), 'Should read notes');
});

runTest('Form calls preventDefault to avoid page reload', () => {
    ok(html.includes('e.preventDefault()'), 'Form should call preventDefault');
});

runTest('Form hides itself and shows success on API response.ok', () => {
    ok(html.includes('form.style.display = \'none\''), 'Form should hide on success');
    ok(html.includes("formSuccess.classList.add('show')"), 'Success should be shown on success');
});

runTest('Flavor field has placeholder with example values', () => {
    const ph = getPlaceholder('input', 'flavor');
    ok(ph && ph.includes('e.g.'), `Flavor placeholder should include example, got: ${ph}`);
});

runTest('Email field has placeholder with @ symbol', () => {
    const ph = getPlaceholder('input', 'email');
    ok(ph && ph.includes('@'), `Email placeholder should include @, got: ${ph}`);
});

runTest('Notes textarea has placeholder text', () => {
    const ph = getPlaceholder('textarea', 'notes');
    ok(ph && ph.length > 0, `Notes textarea should have placeholder, got: ${ph}`);
});

runTest('Success message contains confirmation heading and thank you text', () => {
    const content = getDivTextContent('formSuccess');
    ok(content && content.includes('Request Received'), 'Success message should have confirmation heading');
    ok(content && content.toLowerCase().includes('thank you'), 'Success message should include thank you');
});

console.log('\nBackend Lambda Handler Tests');
console.log('─────────────────────────────────────────────');

runTest('Handler extracts flavor, name, email, notes from request body', () => {
    ok(lambdaCode.includes("body.get('flavor'"), 'Handler should extract flavor');
    ok(lambdaCode.includes("body.get('name'"), 'Handler should extract name');
    ok(lambdaCode.includes("body.get('email'"), 'Handler should extract email');
    ok(lambdaCode.includes("body.get('notes'"), 'Handler should extract notes');
});

runTest('Handler strips whitespace from all fields', () => {
    ok(lambdaCode.includes('.strip()'), 'Handler should strip whitespace from fields');
});

runTest('Handler rejects 400 when flavor, name, or email are missing/empty', () => {
    ok(lambdaCode.includes("not flavor or not name or not email"), 'Handler should validate required fields');
    ok(lambdaCode.includes("'statusCode': 400"), 'Handler should return 400 on validation error');
    ok(lambdaCode.includes('Flavor, name, and email are required'), 'Handler should return descriptive error');
});

runTest('Handler generates UUID for each submission', () => {
    ok(lambdaCode.includes('uuid.uuid4()'), 'Handler should generate unique ID');
});

runTest('Handler stores submission with createdAt timestamp', () => {
    ok(lambdaCode.includes("datetime.utcnow()"), 'Handler should record timestamp');
    ok(lambdaCode.includes("'createdAt'"), 'Handler should store createdAt field');
});

runTest('Handler stores all fields in DynamoDB item', () => {
    ok(lambdaCode.includes("'flavor': flavor"), 'Handler should store flavor');
    ok(lambdaCode.includes("'name': name"), 'Handler should store name');
    ok(lambdaCode.includes("'email': email"), 'Handler should store email');
    ok(lambdaCode.includes("'notes': notes"), 'Handler should store notes');
});

runTest('Handler returns 201 on successful submission', () => {
    ok(lambdaCode.includes("'statusCode': 201"), 'Handler should return 201 on success');
    ok(lambdaCode.includes('Flavor request submitted successfully'), 'Handler should return success message');
});

runTest('Handler returns CORS headers on all responses', () => {
    ok(lambdaCode.includes("'Access-Control-Allow-Origin': '*'"), 'Handler should include CORS origin');
    ok(lambdaCode.includes("'Access-Control-Allow-Headers': 'Content-Type'"), 'Handler should include CORS headers');
    ok(lambdaCode.includes("'Access-Control-Allow-Methods': 'POST, OPTIONS'"), 'Handler should include CORS methods');
});

runTest('Handler returns 500 on unexpected errors', () => {
    ok(lambdaCode.includes("'statusCode': 500"), 'Handler should return 500 on exception');
    ok(lambdaCode.includes("except Exception"), 'Handler should catch exceptions');
});

runTest('Handler reads DynamoDB table from FLAVOR_REQUESTS_TABLE env var', () => {
    ok(lambdaCode.includes("os.environ['FLAVOR_REQUESTS_TABLE']"),
       'Handler should read table name from environment');
});

console.log('\nIntegration Behavior Tests');
console.log('─────────────────────────────────────────────');

runTest('Frontend and backend field names match', () => {
    for (const field of ['flavor', 'name', 'email', 'notes']) {
        ok(html.includes(`'${field}'`), `Frontend should send field "${field}"`);
        ok(lambdaCode.includes(`'${field}'`), `Backend should expect field "${field}"`);
    }
});

runTest('Frontend success state matches backend 201 response', () => {
    ok(html.includes('response.ok'), 'Frontend checks response.ok for success');
    ok(html.includes('form.style.display = \'none\''), 'Frontend hides form on success');
});

runTest('Frontend error handling matches backend 400/500 responses', () => {
    ok(html.includes('throw new Error'), 'Frontend throws error on non-ok response');
    ok(html.includes('alert('), 'Frontend shows alert on error');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────');
const total = 37;
console.log(`Tests passed: ${total - failures} / ${total}`);
console.log(`Tests failed: ${failures} / ${total}`);

if (failures > 0) {
    process.exit(1);
}
