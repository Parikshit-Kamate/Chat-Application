import React from 'react';
import BrandHero from './BrandHero';
import ToastStack from './ToastStack';

function AuthScreen({
  authForm,
  authLoading,
  authMode,
  handleAuthSubmit,
  setAuthForm,
  setAuthMode,
  shellClassName,
  toasts,
}) {
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

        <form onSubmit={handleAuthSubmit}>
          {authMode === 'register' && (
            <>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                type="text"
                value={authForm.firstName || ''}
                onChange={(event) =>
                  setAuthForm((prevForm) => ({
                    ...prevForm,
                    firstName: event.target.value,
                  }))
                }
                placeholder="Enter your first name"
                autoComplete="given-name"
                maxLength={40}
              />

              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                type="text"
                value={authForm.lastName || ''}
                onChange={(event) =>
                  setAuthForm((prevForm) => ({
                    ...prevForm,
                    lastName: event.target.value,
                  }))
                }
                placeholder="Enter your last name"
                autoComplete="family-name"
                maxLength={40}
              />
            </>
          )}

          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={authForm.username}
            onChange={(event) =>
              setAuthForm((prevForm) => ({
                ...prevForm,
                username: event.target.value,
              }))
            }
            placeholder="Enter your username"
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={authForm.password}
            onChange={(event) =>
              setAuthForm((prevForm) => ({
                ...prevForm,
                password: event.target.value,
              }))
            }
            placeholder="12 to 128 characters"
            autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            maxLength={128}
          />

          <button type="submit" disabled={authLoading}>
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}

export default AuthScreen;
