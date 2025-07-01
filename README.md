# WanderRhodes

This project provides a small React frontend and an OpenAI-backed API that acts as a concierge for visitors to Rhodes.

## Development

### Frontend

Run the Vite dev server:

```bash
npm run dev
```

### API

For local development, start the Express API which mirrors the serverless function:

```bash
npm run start-api
```

Both the local server and the Vercel serverless function use the same handler located at `backend/chatHandler.js`.

Ensure that the environment variable `OPENAI_API_KEY` is set before starting the API.

# Wander Rhodes Backend Setup

## Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

## Environment Variables
Create a `.env` file in the root of your project with the following:

```
OPENAI_API_KEY=your_openai_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PRICE_ID=your_stripe_price_id_here
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
DOMAIN=http://localhost:5173
PORT=4242
```

- You can get a Mapbox access token from https://account.mapbox.com/
- Stripe keys and price ID are from your Stripe dashboard.
- OpenAI key is from https://platform.openai.com/api-keys

## Install dependencies
```
npm install
```

## Run the backend server
```
node backend/server.js
```

The backend will start on http://localhost:4242 and provide API endpoints for chat, Mapbox directions, and Stripe payments.

## Troubleshooting
- Make sure your `.env` file is present and filled out.
- Restart the server after changing environment variables.
- Check the backend terminal for debug output if something isn't working.
