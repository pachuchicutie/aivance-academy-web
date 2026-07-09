# AIvance Academy Web

Next.js landing page for the **AIvance Academy 2-Day AI Specialist Starter Bootcamp**. UI is a 1:1 port of the original `aivance-bootcamp.html` reference.

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
  app/           # App Router layout + page + styles
  components/    # Section components (Hero, Schedule, etc.)
public/
  logo.webp
  hero-poster.jpg
  hero-video.mp4
```

## Assets

Logo, hero poster, and hero video were extracted from the original HTML reference file into `public/`.
