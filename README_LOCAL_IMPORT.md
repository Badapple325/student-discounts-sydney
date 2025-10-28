Local import instructions — deals CSV -> deals.json

Quick summary
- The repo contains `deals-export.csv` (generated from current sample data).
- Use `tools/import_deals.js` to import that CSV into `deals.json` locally.
- The script will back up any existing `deals.json` as `deals.json.bak.<ts>`.

PowerShell commands (run in repo root)

1) Run the import (merge into existing deals.json):

```powershell
node .\tools\import_deals.js .\deals-export.csv --merge
```

2) If successful, commit the updated `deals.json` to trigger a redeploy (Vercel):

```powershell
git add deals.json
git commit -m "chore: import deals from CSV (local)"
git push origin main
```

Notes & safety
- Do NOT store secrets (Airtable PAT, ADMIN_KEY) in repo files. Use Vercel project settings or local environment for temporary runs.
- The import creates a timestamped backup if `deals.json` already exists.
- The import script includes basic validation and will print warnings for missing retailer/title or placeholder links.

If you want stronger validation or an interactive preview step, I can add an optional interactive mode next.
