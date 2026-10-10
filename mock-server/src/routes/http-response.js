import { ProductQueryError } from '../catalog/query-products.js';

export function sendError(response, status, code, message) {
  response.status(status).json({ error: { code, message } });
}

export function parseFailQuery(rawFail) {
  if (rawFail === undefined || rawFail === 'false') {
    return false;
  }
  if (rawFail === 'true') {
    return true;
  }

  throw new ProductQueryError('fail must be true or false.');
}

export function sendSimulatedFailure(response) {
  sendError(
    response,
    500,
    'SIMULATED_FAILURE',
    'A simulated catalog failure occurred.',
  );
}

export function sendInvalidQuery(response) {
  sendError(response, 400, 'INVALID_QUERY', 'The catalog query is invalid.');
}
