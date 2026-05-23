# ContactAaron

A highly performant, serverless contact portfolio and administration dashboard for Aaron Micheal Burt. Built entirely on the Cloudflare ecosystem, this project handles contact form submissions securely without relying on external third-party backends.

## Features

- **Dynamic Frontend**: Modern, aesthetic, vanilla HTML/CSS/JS interface designed for optimal responsiveness and UI/UX.
- **Serverless API**: Powered by Cloudflare Pages Functions (`/api/*`), offering seamless integration between static assets and backend logic.
- **Spam Protection**: Integrated with Cloudflare Turnstile to prevent automated abuse on form submissions.
- **D1 Database**: Utilizes Cloudflare's native serverless SQLite database (D1) for persisting contact messages and managing admin superuser accounts.
- **Admin Dashboard**: A secure, authenticated management interface (`/admin`) to view, manage, and delete contact submissions, as well as create and remove admin accounts.
- **Google Chat Integration**: Instant webhook notifications to a Google Chat space upon receiving new messages.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend / Edge Compute**: Cloudflare Pages Functions
- **Database**: Cloudflare D1
- **Security**: Cloudflare Turnstile, Basic Authentication (Admin)

## Prerequisites

- Node.js (v18+ recommended)
- Wrangler CLI (`npm i -g wrangler`)
- A Cloudflare account with Pages and D1 enabled

## Local Development

1. **Install Dependencies**
   Run local development via Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. **Environment Variables**
   For local development, environment variables are loaded from `.dev.vars`. You will need to define:
   ```env
   TURNSTILE_SITE_KEY="<your_site_key>"
   TURNSTILE_SECRET="<your_secret_key>"
   WEBHOOK_URL="<your_google_chat_webhook>"
   ```

3. **Database Setup**
   You need to initialize the D1 database and apply the schema:
   ```bash
   npx wrangler d1 execute contact-db --local --file=schema.sql
   ```

4. **Start Development Server**
   Use the unified Wrangler development server to bind the local D1 database:
   ```bash
   npx wrangler dev
   ```
   *(Note: Local environment requires you to bind the D1 database correctly via CLI if `wrangler dev` does not pick it up automatically, e.g., `npx wrangler pages dev . --d1 DB=contact-db`)*

## Deployment

The project is configured to deploy directly to Cloudflare Pages.

1. Create a D1 Database in the Cloudflare Dashboard and link it in `wrangler.toml`.
2. Apply the schema to the remote database:
   ```bash
   npx wrangler d1 execute contact-db --remote --file=schema.sql
   ```
3. Ensure the production secrets (`TURNSTILE_SECRET`, `WEBHOOK_URL`) are uploaded securely via Cloudflare Secrets:
   ```bash
   echo "<your_secret>" | npx wrangler pages secret put TURNSTILE_SECRET
   ```
4. Push to the connected GitHub repository (or deploy via Wrangler):
   ```bash
   npx wrangler pages deploy .
   ```

## API Documentation

Refer to the included `api-schema.json` or `api-schema.yaml` for OpenAPI 3.0.3 compliant specifications outlining the endpoints, parameters, and authentication requirements for the API layer.
