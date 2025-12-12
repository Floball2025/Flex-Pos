import { type AuthResponse, type LoginCredentials } from "@shared/schema";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  companyId: string | null;
}

// Get stored token
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Set token
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

// Remove token
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Get current user from localStorage
export function getCurrentUser(): AuthUser | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

// Set current user
export function setCurrentUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Remove current user
export function removeCurrentUser(): void {
  localStorage.removeItem(USER_KEY);
}

// Login
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Login failed" }));
    throw new Error(error.error || "Login failed");
  }

  const data: AuthResponse = await response.json();
  
  // Store token and user
  setToken(data.token);
  setCurrentUser(data.user);
  
  return data;
}

// Logout
export function logout(): void {
  removeToken();
  removeCurrentUser();
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getToken() !== null && getCurrentUser() !== null;
}

// Check if user is admin
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === "admin";
}

// Get auth headers
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  
  return {
    "Authorization": `Bearer ${token}`,
  };
}

// Fetch with auth
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...options.headers,
    ...getAuthHeaders(),
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If unauthorized, logout
  if (response.status === 401) {
    logout();
    window.location.href = "/login";
  }
  
  return response;
}

// Get current user from API
export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetchWithAuth("/api/auth/me");
  
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  
  const data = await response.json();
  setCurrentUser(data.user);
  
  return data.user;
}
