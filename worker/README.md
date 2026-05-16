# aidashpy-api (Cloudflare Worker)

Serves `books.json` from KV and cover images from R2 with instant updates — no GitHub deploy lag.

## One-time setup

### 1. Install Wrangler

```bash
cd worker
npm install
npx wrangler login
```

### 2. Create KV namespace

```bash
npx wrangler kv namespace create BOOKS
```

Copy the printed `id` and replace `PLACEHOLDER_KV_ID` in `wrangler.toml`.

### 3. Create R2 bucket

```bash
npx wrangler r2 bucket create aidashpy-covers
```

### 4. Set the admin token

The Worker uses the SHA-256 hash of your admin password as the bearer token.
Compute it (replace `yourpassword`):

```bash
node -e "
  const { createHash } = await import('crypto');
  console.log(createHash('sha256').update('yourpassword').digest('hex'));
" --input-type=module
```

Then set it as a Worker secret:

```bash
npx wrangler secret put ADMIN_TOKEN
# paste the hash when prompted
```

### 5. Seed KV with current books.json

```bash
npx wrangler kv key put --binding KV books "$(cat ../public/books.json)"
```

### 6. Deploy

```bash
npm run deploy
```

The Worker is now live at `https://aidashpy-api.workers.dev`.

### 7. Add env var to the main site

Create or update `../.env.local`:

```
VITE_WORKER_URL=https://aidashpy-api.workers.dev
```

This tells the frontend and sync script where to read/write data.

## Local development

```bash
npm run dev   # starts Worker on http://localhost:8787
```

Set `VITE_WORKER_URL=http://localhost:8787` in `.env.local` to point the frontend at the local Worker.

## How it works

| Route | Method | Auth | Description |
|---|---|---|---|
| `/ping` | GET | — | Health check |
| `/auth` | GET | Bearer | Verify admin token |
| `/books.json` | GET | — | Read book list from KV |
| `/books.json` | PUT | Bearer | Write book list to KV |
| `/images/:name` | GET | — | Serve image from R2 |
| `/images/:name` | PUT | Bearer | Upload image to R2 |

CORS is open to `aidashpy.com`, `aidashpy.github.io`, and `localhost`.
