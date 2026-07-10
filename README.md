# AIvanza Academy Web

Next.js landing page for the **AIvanza Academy 2-Day AI Specialist Starter Bootcamp**. UI is a 1:1 port of the original `aivance-bootcamp.html` reference.

## Stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** (base layer) + custom CSS for exact design match
- **next/font** — Space Grotesk, Inter, JetBrains Mono

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start dev server         |
| `npm run build` | Production build         |
| `npm run start` | Serve production build   |
| `npm run lint`  | Run ESLint               |

## Project structure

```
src/
  app/           # App Router layout + pages + API routes
  components/    # Section + payment components
  lib/           # Batch data, payment types, Supabase clients
supabase/
  migrations/    # Guest payment proof schema (apply to shared Supabase)
public/
  logo.webp
  hero-poster.jpg
  hero-video.mp4
```

## Manual payment / seat reservation

Public flow (Basic tier only):

1. General **Reserve Your Seat** CTAs → `#schedule` (Choose Your Preferred Batch)
2. **Reserve for Batch 1 / Batch 2** → `/payment?batch=1` or `/payment?batch=2`
3. Guest pays via bank / e-wallet / QR, then submits proof (no account required)
4. Admin confirms later; registration invite is emailed after confirmation

### Environment

Copy `.env.example` to `.env.local` and set the same Supabase project used by the admin app:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Database migration (required for live submit)

Apply `supabase/migrations/202607100002_guest_payment_proofs.sql` to the shared Supabase project (SQL editor or CLI). It:

- Extends `payments` for guest fields (`full_name`, `email`, `contact_number`, `batch`, nullable `user_id`)
- Allows public read of active `payment_methods`
- Adds `payment-proofs` storage bucket for receipt images
- Adds `submit_guest_payment_proof()` RPC (always inserts `status = pending`, tier `basic`)
- Updates `confirm_payment` so guest rows (no `user_id`) confirm without auto-enrolling

Add payment methods in the admin portal so the payment page has channels to display.

## Assets

Logo, hero poster, and hero video were extracted from the original HTML reference file into `public/`.
