import React from 'react';
import AuthField from './AuthField';

export default function AuthForm({ authForm, setAuthForm, authMode, authLoading, handleAuthSubmit }) {
  const fieldProps = { authForm, setAuthForm };
  return (
    <form onSubmit={handleAuthSubmit}>
      {authMode === 'register' && (
        <>
          <AuthField {...fieldProps} name="firstName" label="First name" type="text"
            placeholder="Enter your first name" autoComplete="given-name" maxLength={40} />
          <AuthField {...fieldProps} name="lastName" label="Last name" type="text"
            placeholder="Enter your last name" autoComplete="family-name" maxLength={40} />
        </>
      )}
      <AuthField {...fieldProps} name="username" label="Username" type="text"
        placeholder="Enter your username" autoComplete="username" />
      <AuthField {...fieldProps} name="password" label="Password" type="password"
        placeholder="12 to 128 characters" maxLength={128}
        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
      <button type="submit" disabled={authLoading}>
        {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
      </button>
    </form>
  );
}
