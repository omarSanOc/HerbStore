// Runs on the HOST (the Mac), not on the device. It is the PREFLIGHT of the live flow (RF-43): it
// verifies the persistent API is healthy, that the configured product exists, and captures its live
// stock in `output.stock[SLOT]` so the flow can compare "before" and "after".
//
// The API is PERSISTENT and has NO reset: this script never mutates, it only observes. A one-unit
// order lowers the stock of one product by exactly 1, so the stock is the cheapest server-side
// proof of how many orders were created. Because there is no reset, a ZERO stock can never be
// raised again: when the flow needs a buyable product (SLOT=initial), REQUIRE_POSITIVE=true makes a
// non-positive stock an UNMET PRECONDITION, not a failure of the product.
//
// Every unmet precondition throws with an "INCONCLUSA:" marker (RF-44): the run stops BEFORE it
// mutates anything and is reported as inconclusive, never as a product failure, and no reset is
// invented or attempted.
//
// Inputs (env): API_ORIGIN (how the Mac reaches the API), PRODUCT_ID (the configured product),
// SLOT ("initial" or "final", merged into output.stock), REQUIRE_POSITIVE ("true" to require stock > 0).

// 1. Health (RF-7): nothing below is meaningful if the API is not answering.
var health = http.get(API_ORIGIN + '/health');
if (!health.ok) {
  throw new Error('INCONCLUSA: GET /health answered HTTP ' + health.status + ' at ' + API_ORIGIN + '. The API is not reachable; nothing was mutated.');
}
if (json(health.body).status !== 'ok') {
  throw new Error('INCONCLUSA: GET /health did not report { status: "ok" } at ' + API_ORIGIN + '. Nothing was mutated.');
}

// 2. The configured product must exist in the live catalog (its id comes from PRODUCT_ID).
var response = http.get(API_ORIGIN + '/products/' + PRODUCT_ID);
if (!response.ok) {
  throw new Error('INCONCLUSA: GET /products/' + PRODUCT_ID + ' answered HTTP ' + response.status + ' at ' + API_ORIGIN + '. Pick a PRODUCT_ID that is in the live catalog. Nothing was mutated.');
}
var stock = json(response.body).stock;
if (typeof stock !== 'number') {
  throw new Error('INCONCLUSA: GET /products/' + PRODUCT_ID + ' has no numeric "stock". Nothing was mutated.');
}

// 3. Only the preflight requires a buyable product: without a reset a zero stock is a dead end.
//    (`typeof` guards: a flow that omits the flag must not crash with a ReferenceError.)
if (typeof REQUIRE_POSITIVE !== 'undefined' && REQUIRE_POSITIVE === 'true' && stock <= 0) {
  throw new Error('INCONCLUSA: stock of ' + PRODUCT_ID + ' is ' + stock + ' (need > 0). The API has no reset, so pick another PRODUCT_ID with stock. Nothing was mutated.');
}

output.stock = output.stock || {};
output.stock[SLOT] = stock;
console.log('stock[' + SLOT + '] = ' + stock);
