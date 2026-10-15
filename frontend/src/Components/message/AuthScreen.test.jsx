import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import AuthScreen from './AuthScreen';

function AuthHarness({ onSubmit = () => {} }) {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
  });

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    onSubmit({ authMode, authForm });
  };

  return (
    <AuthScreen
      authForm={authForm}
      authLoading={false}
      authMode={authMode}
      handleAuthSubmit={handleAuthSubmit}
      setAuthForm={setAuthForm}
      setAuthMode={setAuthMode}
      shellClassName="message-shell"
      toasts={[]}
    />
  );
}

test('submits login credentials from the real auth form', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();

  render(<AuthHarness onSubmit={handleSubmit} />);

  expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/last name/i)).not.toBeInTheDocument();

  await user.type(screen.getByLabelText(/username/i), 'parikshit');
  await user.type(screen.getByLabelText(/password/i), 'correct-password');
  await user.click(screen.getByRole('button', { name: /^login$/i }));

  expect(handleSubmit).toHaveBeenCalledWith({
    authMode: 'login',
    authForm: {
      firstName: '',
      lastName: '',
      username: 'parikshit',
      password: 'correct-password',
    },
  });
});

test('switches to registration mode without mocking the chat component', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();

  render(<AuthHarness onSubmit={handleSubmit} />);

  await user.click(screen.getByRole('button', { name: /register/i }));
  await user.type(screen.getByLabelText(/first name/i), 'Parikshit');
  await user.type(screen.getByLabelText(/last name/i), 'Singh');
  await user.type(screen.getByLabelText(/username/i), 'new-user');
  await user.type(screen.getByLabelText(/password/i), 'secret-password');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  expect(handleSubmit).toHaveBeenCalledWith({
    authMode: 'register',
    authForm: {
      firstName: 'Parikshit',
      lastName: 'Singh',
      username: 'new-user',
      password: 'secret-password',
    },
  });
});
