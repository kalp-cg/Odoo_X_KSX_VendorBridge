'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, UserPlus, ShieldCheck, Building2, FileText, BarChart3 } from 'lucide-react';
import { useAuthStore, getDefaultRouteForRole } from '@/lib/auth';
import { Button, Field, Input } from '@/components/ui';
import { humanizeError, getFieldErrors } from '@/lib/errors';
import { extractError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().optional(),
    companyName: z.string().min(2, 'Company name is required for vendor signup'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a digit'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);
  const toast = useToast();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', phone: '', companyName: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (params.get('expired') === '1') {
      toast.warning('Session expired', 'Please sign in again.');
    }
    if (params.get('signup') === '1') setMode('signup');
  }, [params, toast]);

  async function onLogin(values: LoginForm) {
    try {
      const user = await login(values.email.trim().toLowerCase(), values.password);
      toast.success('Welcome back!', `Signed in as ${user.fullName}`);
      router.replace(getDefaultRouteForRole(user.role));
    } catch (err) {
      const apiErr = extractError(err);
      const fieldErrors = getFieldErrors(apiErr.details);
      loginForm.setError('root', { message: humanizeError(apiErr) });
      Object.entries(fieldErrors).forEach(([k, v]) => {
        loginForm.setError(k as keyof LoginForm, { message: v });
      });
    }
  }

  async function onSignup(values: SignupForm) {
    try {
      const user = await signup({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || undefined,
        vendorCompany: values.companyName
          ? { legalName: values.companyName, displayName: values.companyName }
          : undefined,
      });
      toast.success('Account created', `Welcome, ${user.fullName}! Your vendor account is pending verification.`);
      router.replace(getDefaultRouteForRole(user.role));
    } catch (err) {
      const apiErr = extractError(err);
      const fieldErrors = getFieldErrors(apiErr.details);
      signupForm.setError('root', { message: humanizeError(apiErr) });
      Object.entries(fieldErrors).forEach(([k, v]) => {
        signupForm.setError(k as keyof SignupForm, { message: v });
      });
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-white/15 grid place-items-center font-bold text-lg">V</div>
          <div>
            <div className="font-semibold text-lg">VendorBridge</div>
            <div className="text-xs text-white/70">Procurement & Vendor Management ERP</div>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-bold leading-tight">Digitise your procurement workflow end-to-end.</h1>
          <p className="text-white/80">From RFQ to invoice, with full audit trail, approvals, and analytics — all in one place.</p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { icon: Building2, label: 'Vendor Lifecycle' },
              { icon: FileText, label: 'RFQ → Quotation' },
              { icon: ShieldCheck, label: 'Approvals & Audit' },
              { icon: BarChart3, label: 'Reports & Insights' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm">
                <f.icon className="h-4 w-4" />
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/60">© {new Date().getFullYear()} VendorBridge</p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 lg:p-10 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">V</div>
            <div className="font-semibold text-ink-800">VendorBridge</div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-ink-800">{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</h2>
            <p className="text-sm text-ink-500 mt-1">
              {mode === 'login' ? 'Welcome back! Please enter your details.' : 'Get started with VendorBridge.'}
            </p>
          </div>

          <div className="mb-5 inline-flex rounded-lg bg-ink-100 p-1 text-sm">
            <button
              onClick={() => setMode('login')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${mode === 'login' ? 'bg-white shadow-sm text-ink-800' : 'text-ink-500'}`}
            >
              <LogIn className="h-3.5 w-3.5 inline-block mr-1" /> Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${mode === 'signup' ? 'bg-white shadow-sm text-ink-800' : 'text-ink-500'}`}
            >
              <UserPlus className="h-3.5 w-3.5 inline-block mr-1" /> Sign Up
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <Field label="Email" required error={loginForm.formState.errors.email?.message}>
                <Input type="email" autoComplete="email" placeholder="you@company.com" {...loginForm.register('email')} />
              </Field>
              <Field label="Password" required error={loginForm.formState.errors.password?.message}>
                <Input type="password" autoComplete="current-password" placeholder="••••••••" {...loginForm.register('password')} />
              </Field>
              {loginForm.formState.errors.root && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {loginForm.formState.errors.root.message}
                </div>
              )}
              <Button type="submit" loading={loginForm.formState.isSubmitting} fullWidth size="lg">
                Sign In
              </Button>
              <div className="text-center">
                <Link href="/forgot-password" className="text-sm">Forgot password?</Link>
              </div>

              <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600 space-y-1">
                <div className="font-semibold text-ink-700">Demo Accounts (Password123!)</div>
                <div>admin@vendorbridge.local · officer@vendorbridge.local · manager@vendorbridge.local</div>
                <div>vendor@acme.example · vendor@bluepeak.example</div>
              </div>
            </form>
          ) : (
            <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
              <Field label="Full Name" required error={signupForm.formState.errors.fullName?.message}>
                <Input placeholder="Jane Doe" {...signupForm.register('fullName')} />
              </Field>
              <Field label="Email" required error={signupForm.formState.errors.email?.message}>
                <Input type="email" placeholder="you@company.com" {...signupForm.register('email')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" error={signupForm.formState.errors.phone?.message}>
                  <Input placeholder="+91 98765 43210" {...signupForm.register('phone')} />
                </Field>
                <Field label="Company" error={signupForm.formState.errors.companyName?.message}>
                  <Input placeholder="Acme Corp" {...signupForm.register('companyName')} />
                </Field>
              </div>
              <Field label="Password" required error={signupForm.formState.errors.password?.message} hint="At least 8 characters">
                <Input type="password" placeholder="••••••••" {...signupForm.register('password')} />
              </Field>
              <Field label="Confirm Password" required error={signupForm.formState.errors.confirmPassword?.message}>
                <Input type="password" placeholder="••••••••" {...signupForm.register('confirmPassword')} />
              </Field>
              {signupForm.formState.errors.root && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {signupForm.formState.errors.root.message}
                </div>
              )}
              <Button type="submit" loading={signupForm.formState.isSubmitting} fullWidth size="lg">
                Create Account
              </Button>
              <p className="text-xs text-ink-500 text-center">
                By creating an account, you agree to the VendorBridge terms of service.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
