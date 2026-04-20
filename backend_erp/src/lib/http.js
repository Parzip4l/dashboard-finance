export function sendJson(response, statusCode, payload, corsOrigin = '*') {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  response.end(JSON.stringify(payload, null, 2));
}

export function sendNoContent(response, corsOrigin = '*') {
  response.writeHead(204, {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });

  response.end();
}
