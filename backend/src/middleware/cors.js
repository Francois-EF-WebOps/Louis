/**
 * CORS middleware for allowing cross-origin requests from frontend
 */

export function handleCors(request) {
  const headers = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }

  return new Response(null, {
    status: 204,
    headers
  })
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response, origin = '*') {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}
