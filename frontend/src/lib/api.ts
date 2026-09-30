const API_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retries = 2
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}/api${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (response.status === 503 && attempt < retries) {
        await wait(1500);
        continue;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          body.code || 'REQUEST_FAILED',
          body.error || 'Request failed.',
          body.details
        );
      }

      if (response.status === 204) return undefined as T;

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof ApiError || attempt >= retries) throw error;
      await wait(1500);
    }
  }
}

export const streamUrl = (kitId: string) =>
  `${API_URL}/api/kits/${kitId}/stream`;