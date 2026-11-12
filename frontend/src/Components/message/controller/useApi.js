import axios from 'axios';
import { useMemo } from 'react';
import { API_URL } from '../constants';
import { createSessionApi } from './sessionApi';

export function useApi(context) {
  const {
    token, session, endSession,
  } = context;

  const transport = useMemo(() => axios.create({ baseURL: `${API_URL}/api` }), []);
  const api = useMemo(() => createSessionApi(transport, session, endSession),
    [transport, session, endSession]);

  const authHeaders = useMemo(() => {
    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }, [token]);

  return {
    api, authHeaders,
  };
}
