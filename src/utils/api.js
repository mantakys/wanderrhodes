// src/utils/api.js

/**
 * Kick off a Stripe Checkout Session.
 * In production, this should POST to your backend endpoint
 * which creates a Stripe CheckoutSession and returns { url }.
 */
export async function createCheckoutSession() {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to create Stripe session');
  const { url } = await res.json();
  // redirect browser to Stripe Checkout
  window.location.href = url;
  return { url };
}

/**
 * For demo purposes only:
 * Simulate your webhook having fired and credited the session.
 * In real use you’d handle this on your server’s Stripe webhook.
 */
export function simulateSuccessfulPayment(sessionId) {
  // e.g. POST to your backend to simulate:
  fetch('/api/simulate-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
}

/**
 * Send a prompt to your AI backend.
 * Expects { response: string, remaining: { free: number, paid: number } }.
 */
export async function sendPrompt(prompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Failed to send prompt');
  return res.json();
}
