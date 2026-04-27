import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private user: { username: string, role: 'admin' | 'user' } | null = null;

  login(username: string, password: string): boolean {

    // DEMO USERS (replace later with backend)
    if (username === 'admin' && password === 'admin') {
        localStorage.setItem('auth', 'true');
        return true;
    }

    if (username === 'user' && password === 'user') {
      this.user = { username, role: 'user' };
      return true;
    }

    return false;
  }

  logout() {
    this.user = null;
  }

  isLoggedIn(): boolean {
    return this.user !== null;
  }

  isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  getUser() {
    return this.user;
  }
}