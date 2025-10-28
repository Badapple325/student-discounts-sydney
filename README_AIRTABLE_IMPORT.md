Airtable import & publish workflow
================================

This document explains how to import the generated CSV into Airtable, run the Assistant to enrich records, and wire an automation to notify this app when records are published.

Files added to repo
- `deals-export.csv` — generated CSV exported from `deals.json` (committed to repo).
- `api/deals-publish.js` — a serverless webhook to receive Airtable publish automation POSTs.

Quick steps (summary)
1. Import `deals-export.csv` into Airtable as a new table (staging table recommended).
2. Create views: 'Imported (for QA)' and 'Ready to publish' (Placeholder = unchecked).
3. Run Airtable Assistant (on the imported view) using the exact prompts below to normalize retailers, infer category, generate `How`, mark placeholders, and create slugs.
4. QA a sample of rows and then check `Published` for rows you want live.
5. Add an Airtable Automation: Trigger when `Published` is checked → Run a webhook action POSTing the record JSON to `https://<your-site>/api/deals-publish` (include `x-admin-key` header with your ADMIN_KEY if you set it in Vercel).

Assistant prompts (copy/paste)

1) Enrich selected records (Retailer normalization, How, Category, Placeholder, Slug):

For each selected record, propose these field updates:
- 'Retailer' normalized (remove extra punctuation, common suffixes like 'Ltd', 'Store')
- 'How' as a single-sentence instruction (10–20 words) on how a student can claim the discount
- 'Category' chosen from: Food & Drink, Fashion, Tech, Transport, Entertainment, Services, Study, Housing, Other
- If Link is empty or contains 'example.com' set 'Placeholder' = true
- 'Slug' as a short lowercase hyphenated string generated from Retailer + Discount Name

Show me the proposed updates so I can preview and apply them.

2) Deduplicate retailers (optional):

Find likely duplicate Retailer names and propose a canonical name to unify them. Show pairs/groups of records that appear to refer to the same retailer.

Automation: sample webhook action

- Trigger: When record matches conditions (e.g., `Published` is checked)
- Action: Run script/webhook
  - URL: https://<your-site-domain>/api/deals-publish
  - Method: POST
  - Headers: { "Content-Type": "application/json", "x-admin-key": "<ADMIN_KEY>" }
  - Body: Use the Airtable 'record (full data)' payload (JSON) so the webhook receives the record fields and ids.

Security notes
- Create an Airtable Personal Access Token and set `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` in Vercel.
- Set `ADMIN_KEY` in Vercel and include the same key as the `x-admin-key` header in the Airtable automation so only your automation can call the webhook.

If you want, I can:
- commit the generated CSV to the repo (done)
- add this webhook endpoint (done)
- provide the exact automation JSON snippet to paste in Airtable (I can generate on request)
