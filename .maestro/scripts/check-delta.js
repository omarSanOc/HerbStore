// Runs on the HOST (the Mac), not on the device, AFTER the purchase. It is the second half of the
// server-side proof of RF-43: one order of one unit must leave `output.stock.final` exactly
// `output.stock.initial - 1`. read-stock.js already recorded the final value (and re-checked health)
// before this script runs; here we only COMPARE the two observed values.
//
// The API is PERSISTENT and SHARED, so a delta other than -1 has two possible causes that this
// script must tell apart (RF-44):
//   - the PRODUCT misbehaved (a second order was created, or none): a REAL failure, only when the
//     run truly had an exclusive window;
//   - another client bought the same product meanwhile (interference): NOT the product's fault, so
//     the run is recorded INCONCLUSA with the observed values, never as a product failure.
// Exclusivity was DECLARED at preflight (E2E_EXCLUSIVE=true). If the operator additionally declares
// interference (INTERFERENCE=true), the delta cannot be attributed to this run, so it is INCONCLUSA.
// No reset is ever invented or attempted (RF-42): a wrong delta under exclusivity simply fails.
//
// Inputs (env): INTERFERENCE ("true" to record INCONCLUSA instead of a product failure).
// Reads (output): output.stock.initial and output.stock.final, both set by read-stock.js.

var initial = output.stock.initial;
var final = output.stock.final;
if (typeof initial !== 'number' || typeof final !== 'number') {
  throw new Error('INCONCLUSA: observed stock is incomplete (initial=' + initial + ', final=' + final + '). The preflight or the final read did not run, so the delta cannot be measured.');
}

if (final === initial - 1) {
  console.log('OK: exactly one order of one unit (initial=' + initial + ' -> final=' + final + ').');
} else if (typeof INTERFERENCE !== 'undefined' && INTERFERENCE === 'true') {
  // The exclusive window did not hold: another client may have bought, so this delta proves nothing
  // about the product. Record INCONCLUSA with the values, do NOT fail the product and do NOT reset.
  throw new Error('INCONCLUSA: interference was declared during the run, so the stock delta is not attributable to this flow (initial=' + initial + ', final=' + final + ', expected ' + (initial - 1) + '). Not a product failure; no reset was attempted.');
} else {
  // Exclusivity was declared and not contradicted: a delta other than -1 is a real product failure
  // (a second order would leave initial-2 or more; a missing order would leave initial).
  throw new Error('FAIL: expected exactly ONE order of one unit (final = initial - 1), but initial=' + initial + ' and final=' + final + '. Under the declared exclusive window this is a real failure of the product, not interference. If another client DID buy meanwhile, re-run with -e INTERFERENCE=true to record it as INCONCLUSA instead.');
}
