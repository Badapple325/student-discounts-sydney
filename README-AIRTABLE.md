Airtable integration notes

Important: Airtable API keys are deprecated. Create a Personal Access Token (PAT) instead and set it in Vercel as `AIRTABLE_TOKEN`.

To enable Airtable persistence for events, resources, and form submissions, set the following environment variables in Vercel:

- AIRTABLE_TOKEN - your Airtable Personal Access Token (preferred)
- AIRTABLE_API_KEY - (optional, legacy) older API key; supported for backward compatibility but may not work for new accounts
- AIRTABLE_BASE_ID - your Airtable Base ID (e.g., appXXXXXXXX)
- AIRTABLE_TABLE_NAME - (optional) table name for Events (default "Events")
- RESOURCES_TABLE_NAME - (optional) table name for resources (default "Resources")
- FORMSPREE_TABLE_NAME - (optional) table name for form submissions (default "FormSubmissions")
- ADMIN_KEY - secret key required to access `/admin.html` and admin API endpoints

How to create a Personal Access Token (PAT):

1. In Airtable, go to Account > API (or visit https://airtable.com/account).
2. Under "API key" you may see a message that API keys are deprecated. Click "Create token".
3. Create a token with the required scopes: at minimum "data.records:read" and "data.records:write" for the Base you plan to use. You can scope the token to specific bases for better security.
4. Copy the token and add it to Vercel as the `AIRTABLE_TOKEN` secret.

Notes:
- Code in this project accepts `AIRTABLE_TOKEN` (PAT) and will fall back to `AIRTABLE_API_KEY` if `AIRTABLE_TOKEN` is not present. Prefer setting `AIRTABLE_TOKEN`.
- The admin UI will overwrite the resources table when saving; the implementation deletes existing records and creates new ones. Be careful with production data.
- For higher volume, consider using a proper backend or database (Supabase, Postgres) and a pagination-aware admin UI.
