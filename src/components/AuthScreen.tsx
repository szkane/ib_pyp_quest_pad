import React, { useState } from 'react';
import { Icon } from './Icons';
import { t } from '../utils';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  updateProfile,
  db,
  doc,
  setDoc,
} from '../firebase';

interface AuthScreenProps {
  lang: string;
  onSwitchLang: (lang: string) => void;
  onToast: (msg: string, kind?: 'good' | 'bad') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ lang, onSwitchLang, onToast }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Sync user profile to Firestore
  const syncUserProfile = async (user: any, nameOverride?: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          id: user.uid,
          email: user.email || '',
          displayName:
            nameOverride ||
            user.displayName ||
            (user.isAnonymous ? (lang === 'zh' ? '游客学员' : 'Guest Learner') : 'Learner'),
          photoURL: user.photoURL || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // Non-blocking profile sync
    }
  };

  const getFriendlyErrorMessage = (err: any) => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return t('auth_email_in_use', lang);
      case 'auth/invalid-email':
        return t('auth_invalid_email', lang);
      case 'auth/weak-password':
        return t('auth_weak_password', lang);
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return t('auth_wrong_credentials', lang);
      case 'auth/popup-blocked':
        return lang === 'zh'
          ? '登录弹窗被浏览器拦截，请允许弹出式窗口后重试'
          : 'Sign-in pop-up was blocked. Please allow pop-ups.';
      default:
        return err?.message || (lang === 'zh' ? '登录失败，请重试' : 'Authentication failed, please try again');
    }
  };

  // 1. Google Sign In
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await syncUserProfile(res.user);
      }
      onToast(lang === 'zh' ? '登录成功！' : 'Signed in successfully!', 'good');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }
      onToast(getFriendlyErrorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };

  // 2. Anonymous / Guest Sign In
  const handleGuestLogin = async () => {
    try {
      setLoading(true);
      const res = await signInAnonymously(auth);
      if (res.user) {
        await syncUserProfile(res.user, lang === 'zh' ? '游客学员' : 'Guest Learner');
      }
      onToast(t('guest_signed_in_toast', lang), 'good');
    } catch (err: any) {
      onToast(getFriendlyErrorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };

  // 3. Email & Password Sign In / Sign Up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      onToast(t('auth_invalid_email', lang), 'bad');
      return;
    }
    if (password.length < 6) {
      onToast(t('auth_weak_password', lang), 'bad');
      return;
    }

    try {
      setLoading(true);
      if (authMode === 'signup') {
        // Register new account
        const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const trimmedName = displayName.trim() || cleanEmail.split('@')[0];
        
        // Update Firebase profile display name
        try {
          await updateProfile(res.user, { displayName: trimmedName });
        } catch {
          // ignore display name update failure
        }

        // Send optional email verification using Firebase built-in mailer
        try {
          await sendEmailVerification(res.user);
        } catch (mailErr) {
          console.warn('Optional email verification notice:', mailErr);
        }

        await syncUserProfile(res.user, trimmedName);
        onToast(t('verification_sent_toast', lang), 'good');
      } else {
        // Sign in existing account
        const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (res.user) {
          await syncUserProfile(res.user);
        }
        onToast(lang === 'zh' ? '登录成功！' : 'Signed in successfully!', 'good');
      }
    } catch (err: any) {
      onToast(getFriendlyErrorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };

  // 4. Password Reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim() || email.trim();
    if (!cleanEmail) {
      onToast(t('auth_invalid_email', lang), 'bad');
      return;
    }

    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, cleanEmail);
      setShowResetModal(false);
      onToast(t('reset_sent_toast', lang), 'good');
    } catch (err: any) {
      onToast(getFriendlyErrorMessage(err), 'bad');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Language Switcher */}
        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end' }}>
          <div className="lang-switcher">
            <button
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => onSwitchLang('en')}
            >
              EN
            </button>
            <button
              className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
              onClick={() => onSwitchLang('zh')}
            >
              中文
            </button>
          </div>
        </div>

        {/* Logo and Brand */}
        <img
          src="/apple-touch-icon-180x180.png"
          alt="IB PYP Quest Pad"
          className="auth-logo"
        />

        <h1 className="auth-title">
          {lang === 'zh' ? 'IB PYP 学习打卡台' : 'IB PYP Quest Pad'}
        </h1>

        <p className="auth-desc">
          {t('sign_in_desc', lang)}
        </p>

        {/* Quick Auth Buttons (Google & Guest) */}
        <div className="auth-quick-buttons">
          <button
            className="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <Icon name="google" size={20} />
            <span>{loading ? (lang === 'zh' ? '正在连接...' : 'Connecting...') : t('sign_in_google', lang)}</span>
          </button>

          <button
            className="guest-login-btn"
            onClick={handleGuestLogin}
            disabled={loading}
            title={t('sign_in_guest_desc', lang)}
          >
            <span style={{ fontSize: 18 }}>🚀</span>
            <span>{t('sign_in_guest', lang)}</span>
            <span className="guest-tag">{lang === 'zh' ? '即开即用' : 'Instant'}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="auth-divider">
          <span className="divider-line" />
          <span className="divider-text">{t('or_email_login', lang)}</span>
          <span className="divider-line" />
        </div>

        {/* Email & Password Segmented Switcher */}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'signin' ? 'active' : ''}`}
            onClick={() => setAuthMode('signin')}
          >
            {t('tab_signin', lang)}
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => setAuthMode('signup')}
          >
            {t('tab_signup', lang)}
          </button>
        </div>

        {/* Email & Password Form */}
        <form className="auth-form" onSubmit={handleEmailAuth}>
          {authMode === 'signup' && (
            <div className="form-group">
              <label className="form-label">{t('display_name_label', lang)}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t('display_name_placeholder', lang)}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('email_label', lang)}</label>
            <input
              type="email"
              className="form-input"
              required
              placeholder={t('email_placeholder', lang)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">{t('password_label', lang)}</label>
              {authMode === 'signin' && (
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => {
                    setResetEmail(email);
                    setShowResetModal(true);
                  }}
                >
                  {t('forgot_password_btn', lang)}
                </button>
              )}
            </div>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input password-input"
                required
                minLength={6}
                placeholder={t('password_placeholder', lang)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            <span>
              {loading
                ? lang === 'zh'
                  ? '处理中...'
                  : 'Processing...'
                : authMode === 'signup'
                ? t('btn_submit_signup', lang)
                : t('btn_submit_signin', lang)}
            </span>
          </button>
        </form>

        {/* Feature Hints Footer */}
        <div className="auth-features">
          <div className="auth-feat-item">
            <div className="auth-feat-icon">✓</div>
            <span>{t('stay_logged_in_hint', lang)}</span>
          </div>
          <div className="auth-feat-item">
            <div className="auth-feat-icon">✓</div>
            <span>{t('auth_multi_provider_hint', lang)}</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Reset Modal */}
      {showResetModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <h3>{t('forgot_password_modal_title', lang)}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowResetModal(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <form onSubmit={handlePasswordReset}>
              <div className="modal-body">
                <p className="hint" style={{ marginBottom: 14 }}>
                  {t('forgot_password_desc', lang)}
                </p>
                <div className="form-group">
                  <label className="form-label">{t('email_label', lang)}</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    placeholder={t('email_placeholder', lang)}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={resetLoading}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-foot">
                <button
                  type="button"
                  className="btn sm soft"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetLoading}
                >
                  {t('btn_cancel', lang)}
                </button>
                <button
                  type="submit"
                  className="btn sm green"
                  disabled={resetLoading}
                >
                  {resetLoading
                    ? lang === 'zh'
                      ? '发送中...'
                      : 'Sending...'
                    : t('btn_send_reset', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
