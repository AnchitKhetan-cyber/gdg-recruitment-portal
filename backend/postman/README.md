# Postman load/functional run — 2000 candidates

Drives the real candidate flow (sign in → start quiz → submit) once per row of
`candidates-2000.csv`.

## Important: what this can and cannot do

Postman **cannot mint a real Google ID token**, so this uses the server's
dev-login bypass. That means:

- It must run against a **local** API started with
  `AUTH_ALLOW_INSECURE_DEV_LOGIN=true`. Never point it at the public tunnel or
  production — the bypass accepts unsigned tokens.
- Postman's Collection Runner runs iterations **sequentially**, so this proves
  the flow works 2000 times. It does **not** simulate 2000 people at once.

For real concurrency and throughput numbers, use the load harness instead —
it drives the same endpoints through a real HTTP stack + Mongo, 100 in flight:

```
npm run test:load -- --users 2000
```

## Steps

1. Start the API locally with the bypass on:
   ```
   # in backend/.env, temporarily:  AUTH_ALLOW_INSECURE_DEV_LOGIN=true
   npm run dev
   ```
2. In Postman: **Import** `gdg-portal.postman_collection.json`.
3. **Collection Runner** → select the collection → **Data** file
   `candidates-2000.csv` → Iterations **2000** → Run.
4. Every request should be green (200). The `responses` variable is captured
   from each start-quiz call so the submit payload is valid.
5. Check results in the admin panel, or:
   `GET http://localhost:8000/api/admin/analytics` (after admin login).
6. **Turn the bypass back off** (`AUTH_ALLOW_INSECURE_DEV_LOGIN=false`) and
   restart before doing anything public.

## Regenerate the CSV

```
node -e "let r=['email,name'];for(let i=1;i<=2000;i++)r.push('loadtest'+i+'@thapar.edu,User '+i);require('fs').writeFileSync('postman/candidates-2000.csv',r.join('\n'))"
```
