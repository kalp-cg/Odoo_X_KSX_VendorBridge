'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button, Card, Field, Input } from '@/components/ui';
import { apiPost } from '@/lib/api';
import type { Envelope } from '@/lib/types';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost<Envelope<{ ok: true }>>('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 p-6">
      <Card className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center text-sm text-ink-500 mb-3"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
        <h1 className="text-xl font-bold text-ink-800">Forgot password</h1>
        <p className="text-sm text-ink-500 mt-1">We'll email you a reset link.</p>
        {sent ? (
          <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            <Mail className="h-4 w-4 inline mr-2" />If an account exists for that email, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" fullWidth loading={loading}>Send reset link</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
