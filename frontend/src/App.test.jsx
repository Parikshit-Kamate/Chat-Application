import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

const mockController = vi.hoisted(() => ({
  authForm: { firstName: '', lastName: '', username: '', password: '' },
  authInitializing: false,
  authLoading: false,
  authMode: 'login',
  currentUser: null,
  handleAuthSubmit: vi.fn(),
  setAuthForm: vi.fn(),
  setAuthMode: vi.fn(),
  shellClassName: 'message-shell',
  toasts: [],
}));

vi.mock('./Components/message/useMessageController', () => ({
  useMessageController: () => mockController,
}));

test('renders the real unauthenticated chat shell', () => {
  render(<App />);

  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
});
