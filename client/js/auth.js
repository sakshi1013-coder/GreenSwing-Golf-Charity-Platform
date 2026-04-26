/**
 * GreenSwing — Authentication Logic (auth.js)
 * Handles: login validation, multi-step registration,
 *          Google login, password toggle, redirect guards.
 *
 * Depends on: gsAuth.js (must be loaded before this file)
 */

document.addEventListener('DOMContentLoaded', function () {
  // If user is already logged in on login / register pages, send them home
  redirectIfAlreadyLoggedIn();

  initLogin();
  initRegister();
  initGoogleLogin();
  initPasswordToggles();
});

/* ────────────────────────────────────────────────
   Redirect away from auth pages if already logged in
──────────────────────────────────────────────── */
function redirectIfAlreadyLoggedIn() {
  if (GsAuth.isLoggedIn()) {
    var u = GsAuth.getUser();
    if (u && u.role === 'admin') {
      window.location.replace('admin.html');
    } else {
      window.location.replace('dashboard.html');
    }
  }
}

/* ────────────────────────────────────────────────
   Password visibility toggle (any page that has it)
──────────────────────────────────────────────── */
function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-toggle-password');
      var input = document.getElementById(targetId);
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = '<i class="fas fa-eye' + (show ? '-slash' : '') + '"></i>';
    });
  });

  // Legacy single toggle (login page password-toggle button)
  var legacyToggle = document.getElementById('password-toggle');
  var legacyInput  = document.getElementById('login-password');
  if (legacyToggle && legacyInput) {
    legacyToggle.addEventListener('click', function () {
      var show = legacyInput.type === 'password';
      legacyInput.type = show ? 'text' : 'password';
      legacyToggle.innerHTML = '<i class="fas fa-eye' + (show ? '-slash' : '') + '"></i>';
    });
  }
}

/* ────────────────────────────────────────────────
   LOGIN
──────────────────────────────────────────────── */
function initLogin() {
  var loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var email    = (document.getElementById('login-email')    || {}).value || '';
    var password = (document.getElementById('login-password') || {}).value || '';

    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (typeof GSAnimation !== 'undefined') {
      GSAnimation.showLoader('Signing you in...');
    } else {
      setButtonLoading(submitBtn, 'Signing in…');
    }

    // Small artificial delay for UX polish
    setTimeout(function () {
      var users = GsAuth.getUsers();

      // Look up user by email (case-insensitive)
      var found = users.find(function (u) {
        return u.email.toLowerCase() === email.toLowerCase();
      });

      if (!found) {
        resetButton(submitBtn, '<i class="fas fa-sign-in-alt"></i> Sign In');
        if (typeof GSAnimation !== 'undefined') GSAnimation.hideLoader();
        showToast('No account found with that email. Please sign up first.', 'error');
        return;
      }

      if (found.password !== password) {
        resetButton(submitBtn, '<i class="fas fa-sign-in-alt"></i> Sign In');
        if (typeof GSAnimation !== 'undefined') GSAnimation.hideLoader();
        showToast('Incorrect password. Please try again.', 'error');
        return;
      }

      // ✅ Auth success — save session
      GsAuth.saveSession({
        email: found.email,
        name:  found.name,
        role:  found.role || 'user',
        charity: found.charity || null,
        plan:    found.plan    || null
      });

      if (typeof GSAnimation !== 'undefined') {
        GSAnimation.showLoader('Fetching your dashboard...');
      }
      showToast('Welcome back, ' + found.name.split(' ')[0] + '! <i class="fas fa-gift"></i>', 'success');

      setTimeout(function () {
        if (found.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 700);
    }, 800);
  });
}

/* ────────────────────────────────────────────────
   GOOGLE LOGIN
──────────────────────────────────────────────── */
function initGoogleLogin() {
  var googleBtn = document.getElementById('social-google');
  if (!googleBtn) return;

  googleBtn.addEventListener('click', function () {
    GsAuth.googleLogin();
  });
}

/* ────────────────────────────────────────────────
   MULTI-STEP REGISTRATION
──────────────────────────────────────────────── */
function initRegister() {
  var steps        = document.querySelectorAll('.auth-step');
  var stepContents = document.querySelectorAll('.step-content');
  var connectors   = document.querySelectorAll('.auth-step-connector');

  if (steps.length === 0) return;

  var currentStep      = 1;
  var selectedCharity  = null;
  var selectedPlan     = 'yearly';
  var charityPct       = 10;

  // ── Step navigation ──
  function goToStep(step) {
    currentStep = step;

    steps.forEach(function (s, i) {
      s.classList.remove('active', 'completed');
      if (i + 1 < step) s.classList.add('completed');
      if (i + 1 === step) s.classList.add('active');
    });

    connectors.forEach(function (c, i) {
      c.classList.toggle('completed', i + 1 < step);
    });

    stepContents.forEach(function (content) {
      content.classList.remove('active');
    });

    var target = document.getElementById('step-' + step);
    if (target) target.classList.add('active');
  }

  // ── Step 1 → 2 ──
  var step1Next = document.getElementById('step1-next');
  if (step1Next) {
    step1Next.addEventListener('click', function () {
      var name     = val('reg-name');
      var email    = val('reg-email');
      var password = val('reg-password');
      var confirm  = val('reg-confirm-password');

      if (!name || !email || !password || !confirm) {
        showToast('Please fill in all fields', 'error');
        return;
      }
      if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
      }
      if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
      }

      // Check for duplicate email
      var users   = GsAuth.getUsers();
      var already = users.find(function (u) {
        return u.email.toLowerCase() === email.toLowerCase();
      });
      if (already) {
        showToast('An account with that email already exists. Please log in.', 'warning');
        return;
      }

      goToStep(2);
    });
  }

  // ── Step 2 back/next ──
  var step2Back = document.getElementById('step2-back');
  if (step2Back) step2Back.addEventListener('click', function () { goToStep(1); });

  var step2Next = document.getElementById('step2-next');
  if (step2Next) {
    step2Next.addEventListener('click', function () {
      if (!selectedCharity) {
        showToast('Please select a charity', 'warning');
        return;
      }
      updateSummary();
      goToStep(3);
    });
  }

  // ── Step 3 back ──
  var step3Back = document.getElementById('step3-back');
  if (step3Back) step3Back.addEventListener('click', function () { goToStep(2); });

  // ── Charity picker ──
  document.querySelectorAll('.charity-picker-item').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.charity-picker-item').forEach(function (i) {
        i.classList.remove('selected');
      });
      item.classList.add('selected');
      selectedCharity = item.dataset.charity;
    });
  });

  // ── Charity search ──
  var charitySearch = document.getElementById('charity-search');
  if (charitySearch) {
    charitySearch.addEventListener('input', function (e) {
      var q = e.target.value.toLowerCase();
      document.querySelectorAll('.charity-picker-item').forEach(function (item) {
        var name = (item.querySelector('h6') || {}).textContent || '';
        var desc = (item.querySelector('p')  || {}).textContent || '';
        item.style.display = (name.toLowerCase().includes(q) || desc.toLowerCase().includes(q)) ? '' : 'none';
      });
    });
  }

  // ── Charity slider ──
  var slider      = document.getElementById('charity-slider');
  var sliderValue = document.getElementById('charity-slider-value');
  if (slider) {
    slider.addEventListener('input', function (e) {
      charityPct = parseInt(e.target.value);
      if (sliderValue) sliderValue.textContent = charityPct + '%';
      updateSummary();
    });
  }

  // ── Plan picker ──
  document.querySelectorAll('.plan-picker-item').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.plan-picker-item').forEach(function (i) {
        i.classList.remove('selected');
      });
      item.classList.add('selected');
      selectedPlan = item.dataset.plan;
      updateSummary();
    });
  });

  // ── Summary ──
  function updateSummary() {
    var prices  = { monthly: 9.99, yearly: 89.99 };
    var price   = prices[selectedPlan] || 89.99;
    var period  = selectedPlan === 'monthly' ? '/mo' : '/yr';
    var charity = (price * charityPct / 100).toFixed(2);
    var pool    = (price - parseFloat(charity)).toFixed(2);

    setText('summary-price',   '£' + price + period);
    setText('summary-percent', charityPct);
    setText('summary-charity', '£' + charity);
    setText('summary-pool',    '£' + pool);
  }

  // ── Final submission ──
  var registerSubmit = document.getElementById('register-submit');
  if (registerSubmit) {
    registerSubmit.addEventListener('click', function () {
      var name     = val('reg-name');
      var email    = val('reg-email');
      var password = val('reg-password');

      if (typeof GSAnimation !== 'undefined') {
        GSAnimation.showLoader('Creating your account...', [
          'Creating account',
          'Securing credentials',
          'Connecting to database'
        ]);
        GSAnimation.updateLoaderStep(0, 'active');
        
        setTimeout(() => {
          GSAnimation.updateLoaderStep(0, 'completed');
          GSAnimation.updateLoaderStep(1, 'active');
        }, 800);

        setTimeout(() => {
          GSAnimation.updateLoaderStep(1, 'completed');
          GSAnimation.updateLoaderStep(2, 'active');
        }, 1600);
        
        setTimeout(() => {
          GSAnimation.updateLoaderStep(2, 'completed');
        }, 2200);
      } else {
        setButtonLoading(registerSubmit, 'Creating account…');
      }

      setTimeout(function () {
        var users = GsAuth.getUsers();

        // Double-check duplicate (race guard)
        var already = users.find(function (u) {
          return u.email.toLowerCase() === email.toLowerCase();
        });
        if (already) {
          resetButton(registerSubmit, '<i class="fas fa-check-circle"></i> Create Account');
          if (typeof GSAnimation !== 'undefined') GSAnimation.hideLoader();
          showToast('An account with that email already exists.', 'warning');
          return;
        }

        var newUser = {
          id:              'user-' + Date.now(),
          name:            name,
          email:           email,
          password:        password,         // plain text for demo; hash in production
          role:            email === 'admin@greenswing.com' ? 'admin' : 'user',
          charity:         selectedCharity,
          charityPct:      charityPct,
          plan:            selectedPlan,
          joinedAt:        new Date().toISOString()
        };

        users.push(newUser);
        GsAuth.saveUsers(users);

        if (typeof GSAnimation !== 'undefined') {
          GSAnimation.showLoader('Account created successfully ✅');
        }
        showToast('Account created! Logging you in...', 'success');

        // Redirect to LOGIN or Dashboard
        setTimeout(function () {
          window.location.href = 'login.html';
        }, 1000);
      }, 2500);
    });
  }
}

/* ────────────────────────────────────────────────
   Utility helpers (local to this file)
──────────────────────────────────────────────── */
function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setButtonLoading(btn, label) {
  if (!btn) return;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;display:inline-block;"></span> ' + label;
  btn.disabled  = true;
}

function resetButton(btn, html) {
  if (!btn) return;
  btn.innerHTML = html;
  btn.disabled  = false;
}

function showToast(msg, type) {
  // Use the global ToastManager from app.js if available
  if (window.toast && window.toast.show) {
    window.toast.show(msg, type || 'info');
  } else {
    // Tiny fallback toast (before app.js finishes)
    var c = document.getElementById('toast-container');
    if (!c) return;
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }
}
