export function createAuthActions(context) {
  const {
    api, authMode, authForm, setAuthLoading, startSession, endSession, pushToast,
  } = context;

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!authForm.username.trim() || !authForm.password) {
      pushToast('Username and password are required.', 'warning');
      return;
    }
    const firstName = String(authForm.firstName || '').trim();
    const lastName = String(authForm.lastName || '').trim();
    if (authMode === 'register' && (!firstName || !lastName)) {
      pushToast('First name and last name are required.', 'warning');
      return;
    }
    try {
      setAuthLoading(true);
      const registering = authMode === 'register';
      const endpoint = registering ? '/auth/register' : '/auth/login';
      const requestBody = { username: authForm.username.trim(), password: authForm.password };
      if (registering) Object.assign(requestBody, { firstName, lastName });
      const response = await api.post(endpoint, requestBody);
      startSession({
        token: response.data.token,
        user: response.data.user,
        authForm: {
          firstName: registering ? firstName : '',
          lastName: registering ? lastName : '',
          username: requestBody.username,
          password: '',
        },
        notice: registering ? 'Account created.' : 'Signed in.',
      });
    } catch (error) {
      pushToast(error.response?.data?.error || 'Cannot reach the backend. Please try again.', 'danger');
    } finally {
      setAuthLoading(false);
    }
  };

  return { handleAuthSubmit, handleLogout: () => endSession() };
}
