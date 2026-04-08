const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface FetchOptions extends RequestInit {
  noAuth?: boolean;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("hermes_token", token);
    } else {
      localStorage.removeItem("hermes_token");
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("hermes_token");
    }
    return this.token;
  }

  async fetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const { noAuth, ...fetchOpts } = options;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(fetchOpts.headers as Record<string, string>),
    };

    if (!noAuth) {
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers,
    });

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API error: ${res.status}`);
    }

    return res.json();
  }

  // Convenience methods
  get<T = any>(path: string) {
    return this.fetch<T>(path);
  }

  post<T = any>(path: string, body?: any) {
    return this.fetch<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(path: string, body?: any) {
    return this.fetch<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(path: string) {
    return this.fetch<T>(path, { method: "DELETE" });
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.post("/api/v1/auth/login", { username, password });
    this.setToken(data.token);
    return data;
  }

  logout() {
    this.setToken(null);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const api = new ApiClient();
