import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Shield,
  Crown,
  Users,
  Calendar,
  Trophy,
  BarChart3,
  Coins,
  Settings,
  ClipboardList,
  Globe,
  Gamepad2,
} from 'lucide-react';
import { AnimalArtwork } from './AnimalIllustrations';
import { AdminAccount } from '../types';
import { setAdminToken } from '../utils/realtimeSync';
import { sound } from '../utils/sound';

interface AdminLoginPageProps {
  onAdminLoginSuccess: (admin: AdminAccount, token: string) => void;
  onSwitchToGamePortal?: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onAdminLoginSuccess,
  onSwitchToGamePortal,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorKm, setErrorKm] = useState<string | null>(null);
  const [errorEn, setErrorEn] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<'km' | 'en'>('km');

  const adminModules = [
    {
      icon: Users,
      titleKm: 'គ្រប់គ្រងគណនីអ្នកលេង',
      titleEn: 'Player Management',
    },
    {
      icon: Calendar,
      titleKm: 'គ្រប់គ្រងជុំនិងកាលវិភាគ',
      titleEn: 'Round & Schedule',
    },
    {
      icon: Trophy,
      titleKm: 'គ្រប់គ្រងលទ្ធផល',
      titleEn: 'Results Management',
    },
    {
      icon: BarChart3,
      titleKm: 'កំណត់ទិន្នន័យភ្នាល់',
      titleEn: 'Betting Records',
    },
    {
      icon: Coins,
      titleKm: 'ហិរញ្ញវត្ថុ និងប្រតិបត្តិការ',
      titleEn: 'Finance & Transactions',
    },
    {
      icon: Settings,
      titleKm: 'ការកំណត់ប្រព័ន្ធ',
      titleEn: 'System Settings',
    },
    {
      icon: ClipboardList,
      titleKm: 'កំណត់ហេតុប្រតិបត្តិការ',
      titleEn: 'Audit Logs',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKm(null);
    setErrorEn(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      sound.playBlocked();
      setErrorKm('សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់ និងពាក្យសម្ងាត់!');
      setErrorEn('Please enter both username and password!');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmedUser, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        setErrorKm(data.error || 'ឈ្មោះអ្នកប្រើប្រាស់ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!');
        setErrorEn(data.errorEn || 'Invalid username or password!');
        setIsLoading(false);
        return;
      }

      sound.playWin();
      setAdminToken(data.token);
      onAdminLoginSuccess(data.admin, data.token);
    } catch {
      sound.playBlocked();
      setErrorKm('មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ សូមព្យាយាមម្តងទៀត!');
      setErrorEn('Unable to connect to server. Please try again!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#09071a] text-white flex flex-col justify-between relative overflow-x-hidden font-['Kantumruy_Pro',sans-serif] select-none">
      {/* Ambient Radial Lighting */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 25%, rgba(124, 58, 237, 0.28) 0%, rgba(46, 16, 101, 0.35) 42%, rgba(9, 7, 26, 0.98) 100%)',
        }}
      />

      {/* Top Bar: Language Switcher & Optional Game Portal Switch */}
      <div className="relative z-20 w-full max-w-[1440px] mx-auto px-4 sm:px-8 pt-4 flex items-center justify-end gap-2.5">
        {onSwitchToGamePortal && (
          <button
            type="button"
            onClick={onSwitchToGamePortal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1a153b]/90 hover:bg-[#251e52] border border-purple-500/30 text-purple-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
            <span>ទំព័រហ្គេម (Game Page)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setLang('km')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            lang === 'km'
              ? 'bg-[#261c52] border-purple-400/60 text-white shadow-sm'
              : 'bg-[#151030]/80 border-purple-500/20 text-slate-300 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4 text-purple-300" />
          <span>ភាសាខ្មែរ</span>
        </button>

        <button
          type="button"
          onClick={() => setLang('en')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            lang === 'en'
              ? 'bg-[#261c52] border-purple-400/60 text-white shadow-sm'
              : 'bg-[#151030]/80 border-purple-500/20 text-slate-300 hover:text-white'
          }`}
        >
          <span>🇬🇧</span>
          <span>English</span>
        </button>
      </div>

      {/* Main 3-Column Layout: Left Brand Showcase | Center Login Modal | Right Admin Modules */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-4">
        <div className="w-full max-w-[1360px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* LEFT COLUMN: Brand Crest & Visual Showcase */}
          <div className="hidden lg:flex lg:col-span-4 flex-col items-center justify-center space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-[0_0_30px_rgba(245,158,11,0.45)] flex items-center justify-center mb-2">
                <div className="w-full h-full rounded-[14px] bg-[#140e30] flex items-center justify-center">
                  <Crown className="w-9 h-9 text-amber-400" />
                </div>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow">
                Lottery12KH
              </h1>
              <div className="flex items-center gap-3 mt-1.5 w-full justify-center">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-amber-400/70" />
                <span className="text-sm font-semibold text-purple-200 tracking-wider">
                  Admin Panel
                </span>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-amber-400/70" />
              </div>
            </div>

            {/* Decorative 2x2 Animal Card Preview Grid with Golden Emblem */}
            <div className="relative w-full max-w-[330px] rounded-2xl bg-[#151036]/80 border border-purple-500/30 p-4 shadow-2xl">
              <div className="grid grid-cols-2 gap-3 opacity-90">
                {[1, 2, 7, 8].map((num) => (
                  <div
                    key={num}
                    className="rounded-xl bg-gradient-to-b from-[#fef3c7] to-[#f59e0b] p-2.5 flex items-center justify-between shadow-md"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900">
                        { num === 1 ? 'ជូត' : num === 2 ? 'ឆ្លូវ' : num === 7 ? 'មមី' : 'មមែ' }
                      </span>
                      <span
                        className={`text-2xl font-black ${
                          num === 1 || num === 7 ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        {num}
                      </span>
                    </div>
                    <div className="w-12 h-12 bg-white/90 rounded-lg p-0.5">
                      <AnimalArtwork number={num} className="w-full h-full object-contain" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-purple-200/80 px-1">
                <span>ប្រព័ន្ធគ្រប់គ្រងឆ្នោត ១២ សត្វ</span>
                <span className="text-amber-300 font-bold">Enterprise v1.0</span>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Administrator Login Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[490px] rounded-[24px] p-[1.5px] bg-gradient-to-b from-purple-400/70 via-purple-600/40 to-indigo-900/60 shadow-[0_20px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(139,92,246,0.25)]">
              <div className="w-full rounded-[23px] bg-gradient-to-b from-[#1c1442]/95 via-[#130e31]/98 to-[#0e0a24] px-6 sm:px-10 py-8 flex flex-col items-center">
                {/* Shield + Crown Crest */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-[2px] shadow-[0_0_25px_rgba(245,158,11,0.45)] mb-3">
                  <div className="w-full h-full rounded-[14px] bg-[#120d2b] flex items-center justify-center">
                    <Shield className="w-8 h-8 text-amber-400" />
                  </div>
                </div>

                <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200">
                  Lottery12KH
                </h2>
                <div className="flex items-center gap-3 w-full justify-center my-1.5">
                  <div className="h-[1px] w-14 bg-gradient-to-r from-transparent to-amber-400/60" />
                  <span className="text-xs sm:text-sm font-semibold text-purple-200">
                    Admin Panel
                  </span>
                  <div className="h-[1px] w-14 bg-gradient-to-l from-transparent to-amber-400/60" />
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white mt-2">
                  ចូលប្រព័ន្ធគ្រប់គ្រង
                </h3>
                <p className="text-xs sm:text-sm text-purple-200/75 mb-6">
                  Administrator Login
                </p>

                {/* Admin Login Form */}
                <form onSubmit={handleSubmit} className="w-full space-y-4">
                  {/* Username Input */}
                  <div className="flex items-center w-full h-13 rounded-xl bg-[#16113a] border border-purple-400/35 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/25 px-4 transition-all">
                    <User className="w-5 h-5 text-purple-300/80 shrink-0" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorKm) {
                          setErrorKm(null);
                          setErrorEn(null);
                        }
                      }}
                      placeholder={
                        lang === 'km'
                          ? 'ឈ្មោះអ្នកប្រើប្រាស់ (Username)'
                          : 'Administrator Username'
                      }
                      autoComplete="username"
                      data-testid="admin-username-input"
                      className="w-full bg-transparent text-white placeholder-purple-200/60 text-sm sm:text-base font-medium pl-3.5 focus:outline-none"
                    />
                  </div>

                  {/* Password Input */}
                  <div className="flex items-center w-full h-13 rounded-xl bg-[#16113a] border border-purple-400/35 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/25 px-4 transition-all">
                    <Lock className="w-5 h-5 text-purple-300/80 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorKm) {
                          setErrorKm(null);
                          setErrorEn(null);
                        }
                      }}
                      placeholder={
                        lang === 'km'
                          ? 'ពាក្យសម្ងាត់ (Password)'
                          : 'Administrator Password'
                      }
                      autoComplete="current-password"
                      data-testid="admin-password-input"
                      className="w-full bg-transparent text-white placeholder-purple-200/60 text-sm sm:text-base font-medium pl-3.5 pr-2 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      data-testid="admin-toggle-password"
                      className="p-1.5 text-purple-300/80 hover:text-amber-300 transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Golden Login Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    data-testid="admin-login-submit"
                    className="w-full h-13 rounded-xl bg-gradient-to-b from-[#fde68a] via-[#f59e0b] to-[#d97706] hover:from-[#fef08a] hover:via-[#fbbf24] hover:to-[#b45309] active:scale-[0.99] text-slate-950 font-black text-base sm:text-lg shadow-[0_6px_25px_rgba(245,158,11,0.4)] border border-yellow-200 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <LogIn className="w-5 h-5 stroke-[2.5]" />
                    <span>
                      {isLoading
                        ? 'កំពុងផ្ទៀងផ្ទាត់... | Verifying...'
                        : 'ចូលប្រព័ន្ធ  |  Login'}
                    </span>
                  </button>

                  {/* Bilingual Error Notification Box */}
                  {errorKm && (
                    <div
                      role="alert"
                      data-testid="admin-login-error"
                      className="w-full rounded-xl bg-[#381028]/95 border border-rose-500/75 px-4 py-3 flex items-center gap-3 text-left shadow-lg"
                    >
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      <div className="flex flex-col text-xs sm:text-sm">
                        <span className="font-bold text-rose-100">{errorKm}</span>
                        {errorEn && (
                          <span className="text-rose-300/90 text-xs mt-0.5">{errorEn}</span>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Admin System Capabilities List */}
          <div className="hidden lg:flex lg:col-span-3 flex-col space-y-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-1 h-5 rounded-full bg-amber-400" />
              <h3 className="text-base font-black text-white tracking-wide">
                ប្រព័ន្ធគ្រប់គ្រង (Admin)
              </h3>
            </div>

            {adminModules.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <div
                  key={idx}
                  className="w-full rounded-xl bg-[#161136]/85 border border-purple-500/25 px-3.5 py-2.5 flex items-center gap-3 shadow-sm hover:border-purple-400/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-600/25 border border-purple-400/30 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-purple-300" />
                  </div>
                  <div className="flex flex-col leading-snug">
                    <span className="text-xs font-bold text-white">{mod.titleKm}</span>
                    <span className="text-[11px] text-purple-200/70">{mod.titleEn}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Security Assurance Footer */}
      <div className="relative z-10 py-3 px-4 border-t border-purple-500/20 bg-[#080617]/90 flex items-center justify-center gap-2 text-xs text-purple-200/80">
        <Shield className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          ការចូលប្រើមានសុវត្ថិភាព និងគ្រប់គ្រងដោយអធិការកិច្ច | Secure Administration Access
        </span>
      </div>
    </div>
  );
};
