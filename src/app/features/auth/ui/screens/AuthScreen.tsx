import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, type RegisterData } from '@/app/app-shell/auth/AuthSessionProvider';
import { SoRitaLogo } from '@/app/shared/components/brand/SoRitaLogo';
import { Input } from '@/app/shared/components/ui/input';
import { Label } from '@/app/shared/components/ui/label';
import {
  Sparkles, Camera, ImagePlus, X, ArrowLeft, ArrowRight,
  User, Mail, Lock, Check,
} from 'lucide-react';
import { toast } from 'sonner';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Step indicator ────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-8 bg-blue-500'
              : i < current
              ? 'w-4 bg-blue-300'
              : 'w-4 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Auth Component ──────────────────────────────────────────
export function Auth() {
  const navigate = useNavigate();
  const { login, register, loginAsDemo } = useAuth();

  // View mode: 'landing' | 'login' | 'register'
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register wizard state
  const [regStep, setRegStep] = useState(0);
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(undefined);
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>(undefined);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const REG_STEPS = [
    { title: 'Seni tanıyalım', subtitle: 'İsim ve kullanıcı adını belirle', icon: User },
    { title: 'Hesap bilgileri', subtitle: 'E-posta ve şifreni oluştur', icon: Lock },
    { title: 'Kendini göster', subtitle: 'Fotoğraflarını ekle (isteğe bağlı)', icon: Camera },
  ];

  // ── Handlers ─────────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(loginEmail, loginPassword)) {
      toast.success('Giriş başarılı!');
      navigate('/home');
    } else {
      toast.error('Geçersiz email veya şifre');
    }
  };

  const handleRegister = () => {
    if (regPassword !== regPasswordConfirm) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }
    if (regUsername.length < 3) {
      toast.error('Kullanıcı adı en az 3 karakter olmalı');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername)) {
      toast.error('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir');
      return;
    }

    const data: RegisterData = {
      email: regEmail,
      password: regPassword,
      name: regName,
      username: regUsername.toLowerCase(),
      profilePhoto,
      coverPhoto,
    };

    if (register(data)) {
      toast.success('Hoş geldin! 🎉');
      navigate('/home');
    } else {
      toast.error('Bu email veya kullanıcı adı zaten kullanılıyor');
    }
  };

  const handleDemoLogin = () => {
    loginAsDemo();
    toast.success('Demo hesapla giriş yapıldı!');
    navigate('/home');
  };

  const handleProfilePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Fotoğraf 2MB'dan küçük olmalı");
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setProfilePhoto(dataUrl);
    }
  };

  const handleCoverPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error("Kapak fotoğrafı 4MB'dan küçük olmalı");
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setCoverPhoto(dataUrl);
    }
  };

  // ── Step validation ──────────────────────────────────────────
  const canGoNext = (): boolean => {
    switch (regStep) {
      case 0:
        return regName.trim().length >= 2 && regUsername.trim().length >= 3;
      case 1:
        return (
          regEmail.includes('@') &&
          regPassword.length >= 6 &&
          regPassword === regPasswordConfirm
        );
      case 2:
        return true; // Photos are optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (regStep < 2) {
      setRegStep(regStep + 1);
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (regStep > 0) {
      setRegStep(regStep - 1);
    } else {
      setView('landing');
    }
  };

  // ── Landing View ─────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-6">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Logo */}
          <div className="mb-2">
            <SoRitaLogo size="lg" />
          </div>
          <p className="text-gray-500 text-sm text-center mb-10">
            Sosyal haritanı oluştur, mekanlarını paylaş
          </p>

          {/* Demo Login */}
          <button
            onClick={handleDemoLogin}
            className="w-full mb-4 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform"
            style={{ fontWeight: 600 }}
          >
            <Sparkles className="size-5" />
            Demo Hesapla Hızlı Giriş
          </button>

          <div className="flex items-center gap-3 my-5 w-full">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">veya</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => setView('login')}
            className="w-full mb-3 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-800 text-sm active:scale-[0.98] transition-transform shadow-sm"
            style={{ fontWeight: 600 }}
          >
            Giriş Yap
          </button>
          <button
            onClick={() => { setView('register'); setRegStep(0); }}
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white text-sm active:scale-[0.98] transition-transform shadow-sm"
            style={{ fontWeight: 600 }}
          >
            Kayıt Ol
          </button>
        </div>
      </div>
    );
  }

  // ── Login View ───────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => setView('landing')}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="size-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-6 pt-4">
          <div className="mb-8">
            <h1 className="text-2xl mb-1" style={{ fontWeight: 700 }}>Tekrar hoş geldin</h1>
            <p className="text-sm text-gray-500">Hesabına giriş yap</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-sm">E-posta</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-sm">Şifre</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Şifreniz"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-blue-500 text-white rounded-xl text-sm active:scale-[0.98] transition-transform shadow-sm shadow-blue-500/25 mt-2"
              style={{ fontWeight: 600 }}
            >
              Giriş Yap
            </button>
          </form>

          {/* Footer */}
          <div className="py-6 text-center">
            <p className="text-sm text-gray-500">
              Hesabın yok mu?{' '}
              <button
                onClick={() => { setView('register'); setRegStep(0); }}
                className="text-blue-500"
                style={{ fontWeight: 600 }}
              >
                Kayıt Ol
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Register Wizard View ─────────────────────────────────────
  const StepIcon = REG_STEPS[regStep].icon;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="size-5 text-gray-700" />
        </button>
        <StepDots current={regStep} total={3} />
        <div className="w-9" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-2">
        {/* Step title */}
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <StepIcon className="size-6 text-blue-500" />
          </div>
          <h1 className="text-2xl mb-1" style={{ fontWeight: 700 }}>
            {REG_STEPS[regStep].title}
          </h1>
          <p className="text-sm text-gray-500">
            {REG_STEPS[regStep].subtitle}
          </p>
        </div>

        {/* Step content */}
        <div className="flex-1">
          {regStep === 0 && (
            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-sm">İsim Soyisim</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Adınız Soyadınız"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="h-12 rounded-xl pl-10"
                    autoFocus
                  />
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-sm">Kullanıcı Adı</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder="kullaniciadi"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="h-12 rounded-xl pl-9"
                    minLength={3}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  En az 3 karakter. Harf, rakam ve alt çizgi kullanılabilir.
                </p>
              </div>
            </div>
          )}

          {regStep === 1 && (
            <div className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm">E-posta</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="ornek@email.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="h-12 rounded-xl pl-10"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-sm">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="En az 6 karakter"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-12 rounded-xl pl-10"
                    minLength={6}
                  />
                </div>
                {/* Password strength hints */}
                <div className="flex gap-1.5 mt-2">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        regPassword.length >= level * 3
                          ? level <= 2
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">
                  {regPassword.length === 0
                    ? 'En az 6 karakter'
                    : regPassword.length < 6
                    ? `${6 - regPassword.length} karakter daha`
                    : regPassword.length < 10
                    ? 'İyi'
                    : 'Güçlü şifre!'}
                </p>
              </div>

              {/* Password Confirm */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-password-confirm" className="text-sm">Şifre Tekrarı</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="reg-password-confirm"
                    type="password"
                    placeholder="Şifrenizi tekrar girin"
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    className={`h-12 rounded-xl pl-10 ${
                      regPasswordConfirm && regPassword !== regPasswordConfirm
                        ? 'border-red-400 focus-visible:ring-red-400'
                        : regPasswordConfirm && regPassword === regPasswordConfirm
                        ? 'border-emerald-400 focus-visible:ring-emerald-400'
                        : ''
                    }`}
                    minLength={6}
                  />
                  {regPasswordConfirm && regPassword === regPasswordConfirm && (
                    <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                  )}
                </div>
                {regPasswordConfirm && regPassword !== regPasswordConfirm && (
                  <p className="text-[11px] text-red-500">Şifreler eşleşmiyor</p>
                )}
              </div>
            </div>
          )}

          {regStep === 2 && (
            <div className="space-y-6">
              {/* Profile Photo */}
              <div className="flex flex-col items-center">
                <div
                  className="relative size-28 rounded-full bg-gray-100 border-3 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors flex-shrink-0"
                  onClick={() => profileInputRef.current?.click()}
                >
                  {profilePhoto ? (
                    <>
                      <img src={profilePhoto} alt="Profil" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfilePhoto(undefined);
                        }}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400">
                      <Camera className="size-7" />
                      <span className="text-[11px]">Fotoğraf Ekle</span>
                    </div>
                  )}
                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhoto}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  Profil fotoğrafını seç
                </p>
              </div>

              {/* Cover Photo */}
              <div className="space-y-2">
                <Label className="text-sm">Kapak Fotoğrafı</Label>
                <div
                  className="relative w-full h-28 rounded-2xl bg-gradient-to-r from-blue-100 to-emerald-100 border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverPhoto ? (
                    <>
                      <img src={coverPhoto} alt="Kapak" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoverPhoto(undefined);
                        }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-1.5 text-gray-400">
                      <ImagePlus className="size-7" />
                      <span className="text-xs">Kapak fotoğrafı ekle</span>
                    </div>
                  )}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverPhoto}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Preview card */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-[11px] text-gray-400 mb-2" style={{ fontWeight: 600 }}>
                  ÖN İZLEME
                </p>
                <div className="flex items-center gap-3">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="size-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-sm" style={{ fontWeight: 600 }}>
                        {regName ? regName[0].toUpperCase() : '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm" style={{ fontWeight: 600 }}>{regName || 'İsim'}</p>
                    <p className="text-xs text-gray-400">@{regUsername || 'kullaniciadi'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="py-5 space-y-3">
          <button
            onClick={handleNext}
            disabled={!canGoNext()}
            className={`w-full h-12 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
              canGoNext()
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            style={{ fontWeight: 600 }}
          >
            {regStep === 2 ? (
              <>
                <Check className="size-4" />
                Hesabı Oluştur
              </>
            ) : (
              <>
                Devam Et
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          {regStep === 2 && (
            <button
              onClick={handleRegister}
              className="w-full text-center text-xs text-gray-400"
            >
              Fotoğraf eklemeden devam et
            </button>
          )}

          {regStep === 0 && (
            <p className="text-center text-sm text-gray-500">
              Zaten hesabın var mı?{' '}
              <button
                onClick={() => setView('login')}
                className="text-blue-500"
                style={{ fontWeight: 600 }}
              >
                Giriş Yap
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
