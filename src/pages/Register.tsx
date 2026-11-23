import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getSettings, registerStudentAccount, getAllStudents } from '../lib/db';
import { validateRegistrationPayload } from '../lib/registrationValidation';
import { hashPassword } from '../lib/passwordHasher';
import { generateCaptchaChallenge, verifyCaptchaChallenge, type CaptchaChallenge } from '../lib/captcha';
import { UserPlus, ShieldAlert, CheckCircle, AlertTriangle, ArrowRight, Eye, EyeOff, RefreshCw, Shield } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const settings = getSettings();
  const isClosed = settings.registration_enabled === false || settings.registrations_open === false;

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    age: '',
    college_name: '',
    email: '',
    password: '',
    confirm_password: '',
    consent_tracking: false,
    consent_guardian: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
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

  const numericAge = parseInt(formData.age, 10);
  const isMinor = !isNaN(numericAge) && numericAge < 18;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isClosed) return;

    // Verify CAPTCHA challenge
    if (!verifyCaptchaChallenge(captcha?.id, captchaInput)) {
      setErrors(prev => ({ ...prev, captcha: 'Incorrect verification answer. Please solve the problem below.' }));
      refreshCaptcha();
      return;
    }

    const existingEmails = getAllStudents().map(s => s.email);
    const val = validateRegistrationPayload(
      {
        ...formData,
        age: parseInt(formData.age, 10),
      },
      { existingEmails, checkPassword: true }
    );

    if (!val.isValid) {
      setErrors(val.errors);
      return;
    }

    setSubmitting(true);
    let hashedPassword = formData.password;
    try {
      hashedPassword = await hashPassword(formData.password);
    } catch (e) {
      console.warn('Failed to hash password client-side, using fallback:', e);
    }

    const res = registerStudentAccount({
      first_name: val.sanitized.first_name,
      last_name: val.sanitized.last_name,
      age: val.sanitized.age,
      college_name: val.sanitized.college_name,
      email: val.sanitized.email,
      password: hashedPassword,
      consent_tracking: formData.consent_tracking,
      consent_guardian: formData.consent_guardian,
    });

    if (!res.success) {
      setErrors({ form: res.error || 'Failed to register account.' });
      setSubmitting(false);
      refreshCaptcha();
      return;
    }

    // Auto login into newly created account
    await login(val.sanitized.email, formData.password);

    if (res.profile?.status === 'pending_approval') {
      navigate('/waiting-approval');
    } else {
      // Instant access: lands on first-time tracking notice then practice
      navigate('/welcome');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-gray-200 p-6 sm:p-10 shadow-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Self-Registration</h1>
          <p className="text-xs text-gray-500 mt-1">
            Create your practice account. Get instant access to practice mode and NTA mock exams.
          </p>
        </div>

        {/* Closed Warning */}
        {isClosed ? (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
            <h2 className="text-sm font-bold text-amber-900">Registrations Are Closed</h2>
            <p className="text-xs text-amber-800">
              New student self-registrations have been paused by the monitor. Please check back later.
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                {errors.form}
              </div>
            )}

            {/* Names row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.first_name ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                  }`}
                />
                {errors.first_name && <p className="text-[11px] text-red-600 mt-1">{errors.first_name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="e.g. Sharma"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.last_name ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                  }`}
                />
                {errors.last_name && <p className="text-[11px] text-red-600 mt-1">{errors.last_name}</p>}
              </div>
            </div>

            {/* Age & College */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="age"
                  min="10"
                  max="99"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="17"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.age ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                  }`}
                />
                {errors.age && <p className="text-[11px] text-red-600 mt-1">{errors.age}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  College / School Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="college_name"
                  value={formData.college_name}
                  onChange={handleChange}
                  placeholder="e.g. Kendriya Vidyalaya / DPS"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.college_name ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                  }`}
                />
                {errors.college_name && <p className="text-[11px] text-red-600 mt-1">{errors.college_name}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.email ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                }`}
              />
              <p className="text-[11px] text-indigo-600 mt-1 font-medium">
                Use an email you can open. We need it to reset your password.
              </p>
              {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
            </div>

            {/* Password & Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    className={`w-full px-3.5 py-2 pr-9 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.password ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-600 mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.confirm_password ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                  }`}
                />
                {errors.confirm_password && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.confirm_password}</p>
                )}
              </div>
            </div>

            {/* Required Consent Checkbox (FR-1.5) */}
            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-700">
                <input
                  type="checkbox"
                  name="consent_tracking"
                  checked={formData.consent_tracking}
                  onChange={handleChange}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <strong className="text-gray-900">Time-Tracking Transparency:</strong> I understand that my solving time per question is tracked and the monitor can see it. <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.consent_tracking && (
                <p className="text-[11px] text-red-600 -mt-1 ml-6">{errors.consent_tracking}</p>
              )}

              {/* Guardian Consent Checkbox for minors */}
              {isMinor && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-indigo-950 font-medium">
                    <input
                      type="checkbox"
                      name="consent_guardian"
                      checked={formData.consent_guardian}
                      onChange={handleChange}
                      className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong className="text-indigo-900">Parental / Guardian Consent:</strong> As I am under 18 years of age, my parent or legal guardian knows I am registering and agrees. <span className="text-red-500">*</span>
                    </span>
                  </label>
                  {errors.consent_guardian && (
                    <p className="text-[11px] text-red-600 ml-6">{errors.consent_guardian}</p>
                  )}
                </div>
              )}
            </div>

            {/* Abuse Protection: CAPTCHA (Amendment 1) */}
            <div className="pt-2 p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Shield size={14} className="text-indigo-600" />
                  <span>Security Verification (CAPTCHA)</span> <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={12} />
                  <span>New challenge</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-indigo-100 text-indigo-900 font-mono font-bold text-sm rounded-lg select-none tracking-wider">
                  {captcha?.prompt || 'Loading...'}
                </div>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={e => setCaptchaInput(e.target.value)}
                  placeholder="Answer"
                  className={`w-28 px-3 py-1.5 text-xs font-mono border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.captcha ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                  }`}
                  required
                />
              </div>
              {errors.captcha && (
                <p className="text-[11px] text-red-600 font-medium">{errors.captcha}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <span>{submitting ? 'Registering...' : 'Register Account'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="text-center mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-800">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
