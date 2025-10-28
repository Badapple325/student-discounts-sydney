Sydney Student Discounts — MVP

What this is

- A minimal static landing page that lists student discounts near Sydney universities (Uni of Sydney, UNSW, UTS, Macquarie, Western Sydney).
- Searchable list of deals stored in `deals.json`.
- Simple email signup form placeholder (uses Formspree URL) — replace with your MailerLite/ConvertKit embed or your Formspree endpoint.

Files created

- `index.html` — site markup and placeholder forms.
- `style.css` — basic styling.
- `script.js` — loads `deals.json`, renders cards, and provides search/filters.
- `deals.json` — sample pre-populated deals (~20) to start with.

Quick local test

- Open `index.html` in your browser locally. The site will load `deals.json` via fetch; to avoid CORS/FS issues, run a small local server, for example with Python:

  ```powershell
  # from the project folder
  python -m http.server 3000
  # then open http://localhost:3000 in your browser
  ```

Deploy to Vercel (recommended)

1. Create a new GitHub repository and push this folder's contents.
2. Sign in to Vercel and choose "Import Project" → select the new GitHub repo.
3. Use default settings and deploy. Vercel will serve the static files and give you a `your-project.vercel.app` URL.

Email signup setup

- Options:
  - MailerLite / ConvertKit: sign up for a free account, create a signup form, and paste their embed snippet into `index.html` where the signup form is.
  - Formspree / Getform: replace `action="https://formspree.io/f/your-id"` with your form endpoint.

Formspree quick setup (fallback)

- Go to https://formspree.io, create a form, and copy the provided action URL. Replace the two `form` action attributes in `index.html` with your endpoint.

Next steps I can do for you (pick any)

- I can push this to a new GitHub repo and connect it to Vercel for you (I'll give instructions for granting access), then deploy and share the URL.
- I can replace the placeholder form with a MailerLite embed if you create a free MailerLite account and give me the embed code (or credentials to configure — optional).
- I can populate the deals list with additional local retailers or convert the data source to Airtable for easy editing.

Promotion & validation plan (2 weeks)

- Post to student Facebook groups, uni clubs Slack/Discord/Discord servers, and Reddit (r/UniSydney, r/UNSW, r/Sydney) with the link to the site.
- Use $50–$80 in Instagram/TikTok ads targeted at 18–25 in Sydney and interests matching university students.
- Measure: aim for 200 visitors and 40–50 email signups in 2 weeks.

Notes

- Replace placeholder Formspree endpoint with a real form provider before running ads.
- Keep `deals.json` up to date; later we can move to Airtable + serverless proxy to allow non-developer edits.

If you'd like, I can connect this repo to Vercel and deploy it now — tell me whether to create a GitHub repo for you (I will prepare files for you to push) or whether you want me to walk you through pushing from your machine.