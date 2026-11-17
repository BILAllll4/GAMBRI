import type { Category, OrderInput, OrderSummary, Product } from '../../shared/schemas'

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: (string | number)[]; message: string }[]) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ApiError(0, 'The store is offline. Start the API with `npm run dev`.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.issues)
  return body as T
}

export const api = {
  categories: () => request<Category[]>('/categories'),
  products: (category?: string) => request<Product[]>(`/products${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  product: (slug: string) => request<Product>(`/products/${encodeURIComponent(slug)}`),
  createOrder: (input: OrderInput) => request<{ reference: string }>('/orders', { method: 'POST', body: JSON.stringify(input) }),
  order: (ref: string) => request<OrderSummary>(`/orders/${encodeURIComponent(ref)}`),
}

export const formatMAD = (n: number) => `${new Intl.NumberFormat('fr-MA').format(n)} MAD`
