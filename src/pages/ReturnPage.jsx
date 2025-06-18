import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function ReturnPage() {
  const [status, setStatus] = useState('loading');
  const [email, setEmail] = useState(null);
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (!sessionId) return;

    fetch(`http://localhost:4242/api/session-status?session_id=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        setStatus(data.status);
        setEmail(data.customer_email);
      });
  }, [sessionId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white p-8"
         style={{ background: '#121212' }}>
      <h1 className="text-3xl font-bold mb-4">Payment Status</h1>
      {status === 'loading' && <p>Checking session...</p>}
      {status === 'complete' && (
        <div className="text-center">
          <p className="text-green-400">✅ Payment successful!</p>
          <p>Welcome, {email || 'traveler'} 🎉</p>
        </div>
      )}
      {status === 'open' && <p className="text-yellow-400">⚠️ Payment not completed</p>}
      {status === 'expired' && <p className="text-red-400">❌ Session expired</p>}
    </div>
  );
}
