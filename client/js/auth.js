/**
 * GreenSwing - Authentication JavaScript
 * Handles login, multi-step registration, charity/plan selection
 */

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initRegister();
});

// ===== Login Form =====
function initLogin() {
  const loginForm = document.getElementById('login-form');
  const passwordToggle = document.getElementById('password-toggle');
  const passwordInput = document.getElementById('login-password');

  if (!loginForm) return;

  // Password visibility toggle
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.innerHTML = `<i class="fas fa-eye${isPassword ? '-slash' : ''}"></i>`;
    });
  }

  // Login form submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      toast.show('Please fill in all fields', 'error');
      return;
    }

    // Simulate login
    const submitBtn = document.getElementById('login-submit');
    submitBtn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px;"></span> Signing in...';
    submitBtn.disabled = true;

    setTimeout(() => {
      // Store demo user in localStorage
      localStorage.setItem('greenswing_user', JSON.stringify({
        id: 'demo-user-1',
        name: 'John Smith',
        email: email,
        role: email === 'admin@greenswing.com' ? 'admin' : 'user',
        charity: 'Health Heroes UK',
        plan: 'yearly'
      }));

      toast.show('Login successful! Redirecting...', 'success');

      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('greenswing_user'));
        if (user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 1000);
    }, 1500);
  });
}

// ===== Multi-Step Registration =====
function initRegister() {
  const steps = document.querySelectorAll('.auth-step');
  const stepContents = document.querySelectorAll('.step-content');
  const connectors = document.querySelectorAll('.auth-step-connector');
  
  if (steps.length === 0) return;

  let currentStep = 1;
  let selectedCharity = null;
  let selectedPlan = 'yearly';
  let charityPercentage = 10;

  // Step navigation
  function goToStep(step) {
    currentStep = step;
    
    // Update step indicators
    steps.forEach((s, i) => {
      s.classList.remove('active', 'completed');
      if (i + 1 < step) s.classList.add('completed');
      if (i + 1 === step) s.classList.add('active');
    });

    // Update connectors
    connectors.forEach((c, i) => {
      c.classList.toggle('completed', i + 1 < step);
    });

    // Show step content
    stepContents.forEach(content => {
      content.classList.remove('active');
    });
    
    const targetStep = document.getElementById(`step-${step}`);
    if (targetStep) {
      targetStep.classList.add('active');
    }
  }

  // Step 1 → Step 2
  const step1Next = document.getElementById('step1-next');
  if (step1Next) {
    step1Next.addEventListener('click', () => {
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password').value;

      if (!name || !email || !password || !confirmPassword) {
        toast.show('Please fill in all fields', 'error');
        return;
      }

      if (password.length < 8) {
        toast.show('Password must be at least 8 characters', 'error');
        return;
      }

      if (password !== confirmPassword) {
        toast.show('Passwords do not match', 'error');
        return;
      }

      goToStep(2);
    });
  }

  // Step 2 → Step 1 (back)
  const step2Back = document.getElementById('step2-back');
  if (step2Back) {
    step2Back.addEventListener('click', () => goToStep(1));
  }

  // Step 2 → Step 3
  const step2Next = document.getElementById('step2-next');
  if (step2Next) {
    step2Next.addEventListener('click', () => {
      if (!selectedCharity) {
        toast.show('Please select a charity', 'warning');
        return;
      }
      updateSummary();
      goToStep(3);
    });
  }

  // Step 3 → Step 2 (back)
  const step3Back = document.getElementById('step3-back');
  if (step3Back) {
    step3Back.addEventListener('click', () => goToStep(2));
  }

  // Charity picker
  const charityItems = document.querySelectorAll('.charity-picker-item');
  charityItems.forEach(item => {
    item.addEventListener('click', () => {
      charityItems.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedCharity = item.dataset.charity;
    });
  });

  // Charity search
  const charitySearch = document.getElementById('charity-search');
  if (charitySearch) {
    charitySearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      charityItems.forEach(item => {
        const name = item.querySelector('h6').textContent.toLowerCase();
        const desc = item.querySelector('p').textContent.toLowerCase();
        item.style.display = (name.includes(query) || desc.includes(query)) ? '' : 'none';
      });
    });
  }

  // Charity slider
  const charitySlider = document.getElementById('charity-slider');
  const charitySliderValue = document.getElementById('charity-slider-value');
  if (charitySlider) {
    charitySlider.addEventListener('input', (e) => {
      charityPercentage = parseInt(e.target.value);
      if (charitySliderValue) {
        charitySliderValue.textContent = charityPercentage + '%';
      }
    });
  }

  // Plan picker
  const planItems = document.querySelectorAll('.plan-picker-item');
  planItems.forEach(item => {
    item.addEventListener('click', () => {
      planItems.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedPlan = item.dataset.plan;
      updateSummary();
    });
  });

  // Summary
  function updateSummary() {
    const prices = { monthly: 9.99, yearly: 89.99 };
    const price = prices[selectedPlan];
    const period = selectedPlan === 'monthly' ? '/mo' : '/yr';
    const charityAmount = (price * charityPercentage / 100).toFixed(2);
    const poolAmount = (price - parseFloat(charityAmount)).toFixed(2);

    const summaryPrice = document.getElementById('summary-price');
    const summaryPercent = document.getElementById('summary-percent');
    const summaryCharity = document.getElementById('summary-charity');
    const summaryPool = document.getElementById('summary-pool');

    if (summaryPrice) summaryPrice.textContent = `£${price}${period}`;
    if (summaryPercent) summaryPercent.textContent = charityPercentage;
    if (summaryCharity) summaryCharity.textContent = `£${charityAmount}`;
    if (summaryPool) summaryPool.textContent = `£${poolAmount}`;
  }

  // Register submit
  const registerSubmit = document.getElementById('register-submit');
  if (registerSubmit) {
    registerSubmit.addEventListener('click', () => {
      registerSubmit.innerHTML = '<span class="spinner" style="width: 20px; height: 20px;"></span> Creating account...';
      registerSubmit.disabled = true;

      setTimeout(() => {
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;

        localStorage.setItem('greenswing_user', JSON.stringify({
          id: 'new-user-' + Date.now(),
          name: name,
          email: email,
          role: 'user',
          charity: selectedCharity,
          charityPercentage: charityPercentage,
          plan: selectedPlan
        }));

        toast.show('Account created successfully! Welcome to GreenSwing! 🎉', 'success');

        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      }, 2000);
    });
  }
}
