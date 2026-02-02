import type { Token, User, UserRegister, UserStats, MessageOutput } from "types";

import { apiRequest, API_BASE_URL, getRefreshToken, clearToken } from "./client";

export async function login(username: string, password: string): Promise<Token> {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Login failed");
  }

  return response.json();
}

export async function register(data: UserRegister): Promise<MessageOutput> {
  return apiRequest<MessageOutput>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuth: true,
  });
}

export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me");
}

export async function getUserStats(): Promise<UserStats> {
  return apiRequest<UserStats>("/auth/me/statistics");
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await apiRequest<MessageOutput>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        skipRefresh: true, // Don't try to refresh during logout
      });
    } catch {
      // Ignore errors during logout - we'll clear tokens anyway
    }
  }

  clearToken();
}
