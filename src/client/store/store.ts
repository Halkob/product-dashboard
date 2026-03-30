import { configureStore } from '@reduxjs/toolkit';
import axios from 'axios';
import authReducer, { api, refreshAccessToken, logout } from './authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// ---------------------------------------------------------------------------
// Axios request interceptor — attach Bearer token from Redux state
// ---------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Axios response interceptor — silent token renewal
// ---------------------------------------------------------------------------
// When any API call returns 401, attempt to get a new access token via the
// httpOnly refresh cookie.  If refresh succeeds, retry the original request
// with the new token.  If refresh fails the user is logged out.
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the failing request IS the refresh endpoint
    if (originalRequest.url?.includes('/auth/refresh')) {
      store.dispatch(logout());
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
        }
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    return new Promise((resolve, reject) => {
      store
        .dispatch(refreshAccessToken())
        .unwrap()
        .then((newToken) => {
          processQueue(null, newToken);
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
          resolve(api(originalRequest));
        })
        .catch((err) => {
          processQueue(err, null);
          store.dispatch(logout());
          reject(err);
        })
        .finally(() => {
          isRefreshing = false;
        });
    });
  },
);
