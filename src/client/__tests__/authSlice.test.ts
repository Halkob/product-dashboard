import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import authReducer, {
  login,
  logout,
  refreshAccessToken,
  clearError,
  setAccessToken,
  AuthState,
} from '../store/authSlice';

vi.mock('axios');

interface TestRootState {
  auth: AuthState;
}

function makeStore(): EnhancedStore<TestRootState> {
  return configureStore<TestRootState>({ reducer: { auth: authReducer } });
}

describe('authSlice reducers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('initial state is correct', () => {
    const store = makeStore();
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('clearError resets error to null', () => {
    const store = makeStore();
    store.dispatch({ type: 'auth/login/rejected', payload: 'some error' });
    store.dispatch(clearError());
    expect(store.getState().auth.error).toBeNull();
  });

  it('setAccessToken updates accessToken', () => {
    const store = makeStore();
    store.dispatch(setAccessToken('test-token'));
    expect(store.getState().auth.accessToken).toBe('test-token');
  });
});

describe('login thunk (reducer cases)', () => {
  const mockUser = { id: 1, email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'CEO' };

  it('sets loading on pending', () => {
    const store = makeStore();
    store.dispatch({ type: login.pending.type });
    expect(store.getState().auth.loading).toBe(true);
    expect(store.getState().auth.error).toBeNull();
  });

  it('sets user and accessToken on fulfilled', () => {
    const store = makeStore();
    store.dispatch({
      type: login.fulfilled.type,
      payload: { accessToken: 'abc', user: mockUser },
    });
    expect(store.getState().auth.user).toEqual(mockUser);
    expect(store.getState().auth.accessToken).toBe('abc');
    expect(store.getState().auth.loading).toBe(false);
  });

  it('sets error on rejected', () => {
    const store = makeStore();
    store.dispatch({ type: login.rejected.type, payload: 'Invalid credentials' });
    expect(store.getState().auth.error).toBe('Invalid credentials');
    expect(store.getState().auth.loading).toBe(false);
  });
});

describe('logout thunk (reducer cases)', () => {
  const mockUser = { id: 1, email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'CEO' };

  it('clears user and accessToken on fulfilled', () => {
    const store = makeStore();
    store.dispatch({ type: login.fulfilled.type, payload: { accessToken: 'abc', user: mockUser } });
    store.dispatch({ type: logout.fulfilled.type });
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.accessToken).toBeNull();
  });

  it('clears user and accessToken even on rejection', () => {
    const store = makeStore();
    store.dispatch({ type: login.fulfilled.type, payload: { accessToken: 'abc', user: mockUser } });
    store.dispatch({ type: logout.rejected.type });
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.accessToken).toBeNull();
  });
});

describe('refreshAccessToken thunk (reducer cases)', () => {
  const mockUser = { id: 1, email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'CEO' };

  it('updates accessToken on fulfilled', () => {
    const store = makeStore();
    store.dispatch({ type: refreshAccessToken.fulfilled.type, payload: 'new-token' });
    expect(store.getState().auth.accessToken).toBe('new-token');
  });

  it('clears user and accessToken on rejection', () => {
    const store = makeStore();
    store.dispatch({ type: login.fulfilled.type, payload: { accessToken: 'abc', user: mockUser } });
    store.dispatch({ type: refreshAccessToken.rejected.type });
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.accessToken).toBeNull();
  });
});
