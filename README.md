# WhatsApp Catalog

A catalog app where customers browse products, build a cart, and the 
order lands as a structured WhatsApp message to the store owner. No 
payment gateway, no monthly fees: the sale closes in the chat, which 
is where small businesses here actually sell.

This is the base version of a system I deployed twice for real stores: 
a jewelry shop for a paying client, and a general store my family runs 
daily. Both are live. This repo is the clean version with example data.
Live demo: https://whatsapp-catalog-pied.vercel.app

## What it does

- Storefront with categories, accent-insensitive search (matches product 
  name, description and category), offers, and a cart that compiles into 
  a WhatsApp order message with per-item links and totals
- Admin panel: products with gallery and variants (each variant has its 
  own price and stock), categories, editable banners, discount coupons, 
  store config
- Stock designed for WhatsApp sales: nothing decrements automatically 
  (a fake order would lock stock for nothing), the owner updates it with 
  one click and items pause at zero

## Stack

Next.js (App Router), TypeScript, Tailwind CSS + shadcn/ui, Prisma with 
PostgreSQL (Neon), Cloudinary for images, Vercel for hosting.

## The auth fix, and why this repo exists

The first deployments shipped with the admin password checked in the 
browser, stored as a constant in the client code. Any visitor could 
read it in the bundle, and worse: the server actions behind it didn't 
verify a session at all. The lock was painted on the door.

This version fixes it:

- Login is a server action that checks ADMIN_PASSWORD from the env 
  (no fallback: if the variable is missing, everything is rejected) 
  and creates a session row in the database
- The session token travels as an httpOnly cookie
- Every mutating server action calls a requireAuth() guard that 
  validates the session against the DB before touching data
- Editing sessionStorage in the browser shows you the panel UI, but 
  every action replies "No autorizado". The browser no longer decides

## Known limitations

- TypeScript build errors are still ignored in next.config.ts, a 
  shortcut from the original delivery. Removing that and fixing the 
  types is on the roadmap
- The storefront is one large page component; splitting it into hooks 
  and components is the next refactor
- Creating a product with only an external image URL doesn't save the 
  image (editing does). Needs fixing
- Admin-only reads (the full product list) are still open endpoints. 
  Only writes are gated today
- heroTitle and heroImage in SiteConfig are unused leftovers from the 
  first version

## Run it

1. Create a free Postgres database (Neon works) and a free Cloudinary 
   account
2. Copy .env.example to .env and fill in your values
3. npm install
4. npx prisma generate
5. npx prisma db push
6. npm run dev