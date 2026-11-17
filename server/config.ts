import 'node:process'

/** All runtime configuration comes from environment variables (see .env.example). */
export const config = {
  port: Number(process.env.API_PORT ?? 8787),
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'gnawa',
  },
  /** flat delivery fee in MAD; 0 until the merchant sets real rates */
  shippingFlatMad: Number(process.env.SHIPPING_FLAT_MAD ?? 0),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
}
