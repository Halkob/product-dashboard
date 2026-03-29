import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  loading: false,
  error: null,
};

// Axios instance — refresh token is stored in httpOnly cookie (handled by browser automatically)
// Access token is kept in Redux memory only (never persisted to localStorage)
export const api = axios.create({ baseURL: '/api', withCredentials: true });

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', credentials);
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.error?.message ?? 'Login failed');
      }
      return rejectWithValue('Login failed');
    }
  },
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_: void, { getState, rejectWithValue }) => {
    const state = (getState() as { auth: AuthState }).auth;
    try {
      await api.post('/auth/logout-all', null, {
        headers: { Authorization: `Bearer ${state.accessToken}` },
      });
      return;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.error?.message ?? 'Logout failed');
      }
      return rejectWithValue('Logout failed');
    }
  },
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refresh',
  async (_: void, { rejectWithValue }) => {
    try {
      const res = await api.post<{ accessToken: string }>('/auth/refresh');
      return res.data.accessToken;
    } catch {
      return rejectWithValue('Session expired');
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        // Clear local state even if server call fails
        state.user = null;
        state.accessToken = null;
      })
      // refresh
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
      });
  },
});

export const { clearError, setAccessToken } = authSlice.actions;
export default authSlice.reducer;
