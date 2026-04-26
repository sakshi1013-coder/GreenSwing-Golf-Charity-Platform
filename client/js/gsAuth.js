/**
 * GreenSwing — Central Authentication Module (gsAuth.js)
 * Include this file BEFORE any page-specific JS on protected pages.
 *
 * Exports (on window.GsAuth):
 *   checkAuth(requireAdmin?)  – redirects to login if not authenticated
 *   logout()                  – clears session, goes to landing
 *   getUser()                 – returns parsed session object or null
 *   getUsers()                – returns registered users array
 *   saveSession(userData)     – persists session to localStorage
 *   isLoggedIn()              – boolean check
 */

(function () {
  'use strict';

  const SESSION_KEY  = 'user';   // active session
  const USERS_KEY    = 'users';     // registered users list
  const LOGIN_URL    = '../pages/login.html';
  const LANDING_URL  = '../index.html';

  /* ─────────────────────────────────────────────
     Core helpers
  ───────────────────────────────────────────── */

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    const u = getUser();
    return !!(u && u.isLoggedIn === true);
  }

  function saveSession(userData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      isLoggedIn: true,
      ...userData
    }));
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = LANDING_URL;
  }

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  /* ─────────────────────────────────────────────
     Route guard — call at top of every protected page.
     Pass requireAdmin=true for admin-only pages.
  ───────────────────────────────────────────── */

  function checkAuth(requireAdmin) {
    // Hide body immediately to prevent flash
    document.documentElement.style.visibility = 'hidden';

    if (!isLoggedIn()) {
      window.location.replace(LOGIN_URL);
      return; // stop further execution
    }

    if (requireAdmin) {
      const u = getUser();
      if (!u || u.role !== 'admin') {
        window.location.replace(LOGIN_URL);
        return;
      }
    }

    // Auth passed — reveal page
    document.documentElement.style.visibility = 'visible';

    // Back-button guard: after auth check passes, push state so
    // pressing Back takes the user to login, not the protected page.
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', function () {
      window.location.replace(LOGIN_URL);
    });
  }

  /* ─────────────────────────────────────────────
     Google login (Firebase stub — wire up your
     Firebase config to make this real)
  ───────────────────────────────────────────── */

  function googleLogin() {
    // If Firebase is loaded, use it; otherwise show a friendly message.
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider)
        .then(function (result) {
          const u = result.user;
          saveSession({
            email: u.email,
            name: u.displayName,
            avatar: u.photoURL,
            role: 'user'
          });
          window.location.href = '../pages/dashboard.html';
        })
        .catch(function (err) {
          console.error('Google login error', err);
          alert('Google sign-in failed: ' + err.message);
        });
    } else {
      // Dev/demo fallback – remove in production
      alert(
        'Google Sign-In requires Firebase to be configured.\n\n' +
        'Add your Firebase project config and uncomment the SDK scripts ' +
        'in login.html to enable real Google OAuth.'
      );
    }
  }

  /* ─────────────────────────────────────────────
     Expose public API
  ───────────────────────────────────────────── */

  window.GsAuth = {
    checkAuth,
    logout,
    getUser,
    isLoggedIn,
    saveSession,
    getUsers,
    saveUsers,
    googleLogin,
    USERS_KEY,
    SESSION_KEY,
    LOGIN_URL,
    LANDING_URL
  };

})();
