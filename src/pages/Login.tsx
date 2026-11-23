import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { generateCaptchaChallenge, verifyCaptchaChallenge, type CaptchaChallenge } from '../lib/captcha';
import { BookOpen, Loader2, Shield, RefreshCw } from 'lucide-react';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaInput, setCaptchaInput] = useState('');

  useEffect(() => {
    setCaptcha(generateCaptchaChallenge());
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptchaChallenge());
    setCaptchaInput('');
  };

  React.useEffect(() => {
    if (user) {
      navigate(user.role === 'student' ? '/practice' : '/monitor', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // CAPTCHA Verification (Amendment 1)
    if (!verifyCaptchaChallenge(captcha?.id, captchaInput)) {
      setError('Incorrect security verification answer. Please solve the problem below.');
      refreshCaptcha();
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        setError(result.error || 'Login failed.');
        refreshCaptcha();
      }
    } catch {
      setError('An unexpected error occurred during sign in. Please try again.');
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-700 text-white rounded-2xl shadow-lg mb-3">
            <BookOpen size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">JEE Practice Hub</h1>
          <p className="text-sm text-gray-600 mt-1">Class 12 JEE Main Practice & Monitoring Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm disabled:opacity-50"
                placeholder="you@jeepractice.local"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm disabled:opacity-50"
                placeholder="••••••••"
                required
              />
            </div>

            {/* CAPTCHA Challenge (Amendment 1) */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Shield size={14} className="text-blue-600" />
                  <span>Security Verification (CAPTCHA)</span>
                </label>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={12} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-blue-100 text-blue-900 font-mono font-bold text-sm rounded-lg select-none">
                  {captcha?.prompt || 'Loading...'}
                </div>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={e => setCaptchaInput(e.target.value)}
                  placeholder="Answer"
                  className="w-28 px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="text-center pt-1">
            <span className="text-xs text-gray-500">Need an account? </span>
            <Link to="/register" className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline">
              Register as student
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          JEE Practice Hub · Student Self-Registration with Monitor Approval
        </p>
      </div>
    </div>
  );
}
