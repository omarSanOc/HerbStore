// Runs on the HOST (the Mac), not on the device: it asks the mock server for the live stock of
// one product and stores it in `output.stock[SLOT]` so the flow can compare "before" and "after".
// The mock keeps its orders in memory, so stock is the cheapest server-side proof of how many
// orders were created: one order of one unit lowers it by exactly 1, two orders by 2.
const response = http.get(API_ORIGIN + '/products/' + PRODUCT_ID);
if (!response.ok) {
  throw new Error('Mock server answered HTTP ' + response.status + ' for ' + PRODUCT_ID + '. Is it running at ' + API_ORIGIN + '?');
}
const stock = json(response.body).stock;
if (typeof stock !== 'number') {
  throw new Error('GET /products/' + PRODUCT_ID + ' has no numeric "stock".');
}
output.stock = output.stock || {};
output.stock[SLOT] = stock;
console.log('stock[' + SLOT + '] = ' + stock);
