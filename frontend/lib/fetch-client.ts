/**
 * Shared fetch wrapper with error handling for API clients.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API Error ${status}: ${statusText}`)
    this.name = 'ApiError'
  }
}

interface FetchOptions extends RequestInit {
  /** Base URL to prepend to the path */
  baseUrl?: string
}

/**
 * Shared fetch wrapper that handles JSON serialization, error responses,
 * and common headers.
 */
export async function fetchClient<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { baseUrl = '', ...fetchOptions } = options

  const url = `${baseUrl}${path}`

  const headers = new Headers(fetchOptions.headers)

  // Set Content-Type for JSON bodies if not already set
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      // Response body is not JSON
    }
    throw new ApiError(response.status, response.statusText, body)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
