import React from 'react';
import BrandHero from './BrandHero';
import ToastStack from './ToastStack';
import AuthForm from './auth/AuthForm';

export default function AuthScreen(props) {
  const { authMode, setAuthMode, shellClassName, toasts } = props;
  return (
    <div className={`${shellClassName} auth-screen`}>
      <div className="auth-card">
        <BrandHero />
        <div className="auth-toggle">
          <button
            type="button"
            className={authMode === 'login' ? 'active' : ''}
            onClick={() => setAuthMode('login')}
            aria-label="Switch to login"
          >
            Login
          </button>
          <button
            type="button"
            className={authMode === 'register' ? 'active' : ''}
            onClick={() => setAuthMode('register')}
            aria-label="Switch to register"
          >
            Register
          </button>
        </div>
        <AuthForm {...props} />
      </div>
      <ToastStack toasts={toasts} />
    </div>
  );
}
