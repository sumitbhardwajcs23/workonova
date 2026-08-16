export interface UserPayload {
  id: number;
  name: string;
  email: string;
  role: 'client' | 'freelancer' | 'admin' | 'qa_admin';
}

export function getToken(): string | null {
  return localStorage.getItem('worknova_token');
}

export function setToken(token: string) {
  localStorage.setItem('worknova_token', token);
}

export function getUser(): UserPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as UserPayload;
  } catch (e) {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('worknova_token');
  window.location.href = '/';
}
