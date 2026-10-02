import React, { useState } from 'react';
import { Icon } from './Icons';
import { t } from '../utils';
import { auth, googleProvider, signInWithPopup, db, doc, setDoc } from '../firebase';

interface AuthScreenProps {
  lang: string;
  onSwitchLang: (lang: string) => void;
  onToast: (msg: string, kind?: 'good' | 'bad') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ lang, onSwitchLang, onToast }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        try {
          const userRef = doc(db, 'users', res.user.uid);
          await setDoc(
            userRef,
            {
              id: res.user.uid,
              email: res.user.email || '',
              displayName: res.user.displayName || '',
              photoURL: res.user.photoURL || '',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch {
          // Non-blocking profile sync
        }
      }
      onToast(lang === 'zh' ? '登录成功！' : 'Signed in successfully!', 'good');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // User voluntarily dismissed or cancelled the popup window
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        onToast(
          lang === 'zh'
            ? '登录弹窗被浏览器拦截，请允许弹出式窗口后重试'
            : 'Sign-in pop-up was blocked by your browser. Please allow pop-ups.',
          'bad'
        );
        return;
      }
      console.warn('Google Sign In Notice:', err?.message || err);
      onToast(
        err?.message || (lang === 'zh' ? '登录未完成，请重试' : 'Sign in failed, please try again'),
        'bad'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
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

        <button
          className="google-login-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <Icon name="google" size={20} />
          <span>{loading ? (lang === 'zh' ? '正在连接...' : 'Connecting...') : t('sign_in_google', lang)}</span>
        </button>

        <div className="auth-features">
          <div className="auth-feat-item">
            <div className="auth-feat-icon">✓</div>
            <span>{t('stay_logged_in_hint', lang)}</span>
          </div>
          <div className="auth-feat-item">
            <div className="auth-feat-icon">✓</div>
            <span>{t('google_only_hint', lang)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
