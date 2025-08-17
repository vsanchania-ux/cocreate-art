# CoCreate Art — MVP (Next.js + Tailwind)

A minimal, deploy-ready version of the collaborative, edge-to-edge drawing app.

## Local Dev

1. Install Node.js LTS (https://nodejs.org)
2. Install deps:
   ```bash
   npm install
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```
4. Visit http://localhost:3000

## Deploy to Vercel

1. Create a new GitHub repo and upload these files.
2. In Vercel:
   - **Add New Project** → **Import Git Repository** → pick your repo
   - Framework preset: Next.js (detected automatically)
   - Click **Deploy**

That's it — you'll get a *.vercel.app* URL.

## Notes

- MVP is local-only (no realtime server). It supports drawing, pen/eraser, brush size/color, grid, undo/redo, lock/unlock, signature, edge code export/import, and PNG download.
- For realtime multiuser collab, add a backend (Supabase Realtime/Firebase/Socket.IO) and broadcast strokes or use CRDT (Yjs).
- Be mindful of legal terms if you plan to claim ownership of user art. In many jurisdictions (UK/EU), getting explicit contributor licenses or assignments is more practical and user-friendly than asserting blanket ownership.
