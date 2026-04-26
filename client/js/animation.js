/**
 * GreenSwing Core Animations & Transitions
 * Handles Cinematic Intro, Global Loader, and SPA transitions.
 */

class GSAnimation {
  static init() {
    // Failsafe: Ensure body ALWAYS becomes visible after 5 seconds regardless of JS errors
    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 5000);

    try {
      // 1. Handle Intro Animation on Landing Page
      if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        this.playLandingIntro();
      } else {
        // For other pages, just fade in the body
        document.body.classList.add('loaded');
        if (typeof initDashboardAnimations === 'function') {
          setTimeout(initDashboardAnimations, 300);
        }
      }

      // 2. Setup Global Loader DOM
      this.injectGlobalLoader();
    } catch (err) {
      console.error("GSAnimation Initialization Error:", err);
      document.body.classList.add('loaded');
    }
  }

  // --- PART 1 & 2: Landing Cinematic Intro ---
  static playLandingIntro() {
    let trailInterval;
    let tl; // Declare first to avoid TDZ reference errors in skipIntro
    
    // Create Intro Overlay
    const overlay = document.createElement('div');
    overlay.id = 'intro-overlay';
    overlay.innerHTML = `
      <div class="intro-scene" id="intro-scene"></div>
      <button class="intro-skip-btn" id="intro-skip">Skip Intro &rarr;</button>
      <div class="intro-shadow"></div>
      
      <!-- Inline SVG Ball -->
      <svg class="intro-ball" id="intro-ball" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ball-grad" cx="30%" cy="30%" r="70%" fx="20%" fy="20%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="60%" stop-color="#e2e8f0"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </radialGradient>
          <filter id="ball-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#ball-grad)" filter="url(#ball-glow)"/>
        <circle cx="20" cy="20" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="32" cy="16" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="44" cy="20" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="16" cy="32" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="32" cy="32" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="48" cy="32" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="20" cy="44" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="32" cy="48" r="1.5" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="44" cy="44" r="1.5" fill="#cbd5e1" opacity="0.6"/>
      </svg>

      <!-- Inline SVG Club -->
      <svg class="intro-club" id="intro-club" width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shaft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#94a3b8"/>
            <stop offset="50%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#475569"/>
          </linearGradient>
          <linearGradient id="head" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0"/>
            <stop offset="70%" stop-color="#64748b"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <filter id="shadow" x="0" y="0" width="150%" height="150%">
            <feDropShadow dx="-2" dy="2" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        <rect x="120" y="10" width="8" height="220" rx="4" fill="url(#shaft)" filter="url(#shadow)"/>
        <rect x="116" y="10" width="16" height="60" rx="3" fill="#1e293b"/>
        <path d="M 115 220 L 70 230 C 60 232, 50 240, 50 250 L 140 250 C 145 250, 150 240, 140 230 C 135 225, 125 220, 115 220 Z" fill="url(#head)" filter="url(#shadow)"/>
      </svg>
      
      <div class="impact-flash" id="impact-flash"></div>
    `;
    document.body.appendChild(overlay);

    const ball = document.getElementById('intro-ball');
    const club = document.getElementById('intro-club');
    const flash = document.getElementById('impact-flash');
    const scene = document.getElementById('intro-scene');
    const skipBtn = document.getElementById('intro-skip');

    // Function to finish early
    const skipIntro = () => {
      if (tl) tl.kill();
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.add('loaded');
      setTimeout(() => overlay && overlay.remove(), 1000);
      clearInterval(trailInterval);
    };

    skipBtn.addEventListener('click', skipIntro);
    
    // GSAP Timeline
    tl = gsap.timeline({
      onComplete: skipIntro
    });

    // Initial setup
    gsap.set(club, { opacity: 1, rotation: -40, x: -150, y: -20 });
    gsap.set(ball, { xPercent: -50, y: 0, scale: 1 }); // Use xPercent for clean centering
    
    // 1. Club backswing
    tl.to(club, {
      rotation: -60,
      x: -180,
      y: -40,
      duration: 0.8,
      ease: "power2.inOut"
    })
    
    // 2. Downswing (fast acceleration)
    .to(club, {
      rotation: 10,
      x: 0,
      y: 0,
      duration: 0.2,
      ease: "power4.in",
      onStart: () => club.classList.add('motion-blur'),
      onComplete: () => club.classList.remove('motion-blur')
    })
    
    // 3. Impact Moment
    .to(flash, {
      scale: 1,
      opacity: 0.8,
      duration: 0.05,
      yoyo: true,
      repeat: 1
    }, "-=0.05")
    
    // Screen shake
    .to(overlay, {
      x: 5, y: -5,
      duration: 0.05,
      yoyo: true,
      repeat: 3
    }, "-=0.05")
    
    // 4. Ball launch & trajectory towards screen
    .to(ball, {
      y: '-=100', // slight arc up and then basically covers screen
      rotation: 360,
      scale: 100, // Make it massively scale towards camera
      opacity: 0, // fade out at very end to reveal screen
      duration: 1.5,
      ease: "power2.in",
      onStart: () => {
        // Start particle trail
        trailInterval = setInterval(() => {
          const rect = ball.getBoundingClientRect();
          GSAnimation.createParticle(rect.left + rect.width/2, rect.top + rect.height/2);
        }, 50);
      }
    }, "-=0.1")
    
    // Club follow-through
    .to(club, {
      rotation: 80,
      x: 50,
      y: -80,
      opacity: 0,
      duration: 0.5,
      ease: "power2.out"
    }, "-=1.5");
  }

  static createParticle(x, y) {
    const p = document.createElement('div');
    p.className = 'intro-particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    document.body.appendChild(p);

    gsap.to(p, {
      x: () => (Math.random() - 0.5) * 50,
      y: () => (Math.random() * 50) + 20,
      scale: 0,
      opacity: 0,
      duration: 1 + Math.random() * 0.5,
      ease: "power2.out",
      onComplete: () => p.remove()
    });
  }

  // --- PART 3 & 6: Global Loader System ---
  static injectGlobalLoader() {
    if (document.getElementById('global-app-loader')) return;

    const loader = document.createElement('div');
    loader.id = 'global-app-loader';
    loader.innerHTML = `
      <div class="auth-loader-spinner"></div>
      <div class="auth-loader-text" id="loader-txt">Processing...</div>
      <div class="auth-loader-steps" id="loader-steps-container" style="display: none;"></div>
    `;
    document.body.appendChild(loader);
  }

  static showLoader(text, steps = null) {
    const loader = document.getElementById('global-app-loader');
    const txt = document.getElementById('loader-txt');
    const container = document.getElementById('loader-steps-container');
    
    txt.textContent = text;
    
    if (steps && steps.length > 0) {
      container.style.display = 'flex';
      container.innerHTML = steps.map((s, i) => `
        <div class="auth-loader-step" id="loader-step-${i}">
          <i class="fas fa-circle-notch fa-spin"></i>
          <span>${s}</span>
        </div>
      `).join('');
    } else {
      container.style.display = 'none';
      container.innerHTML = '';
    }

    loader.classList.add('active');
  }

  static updateLoaderStep(index, status) {
    const step = document.getElementById(`loader-step-${index}`);
    if (!step) return;

    const icon = step.querySelector('i');
    
    if (status === 'active') {
      step.classList.add('active');
      step.classList.remove('completed');
      icon.className = 'fas fa-circle-notch fa-spin';
    } else if (status === 'completed') {
      step.classList.remove('active');
      step.classList.add('completed');
      icon.className = 'fas fa-check-circle';
    }
  }

  static hideLoader() {
    const loader = document.getElementById('global-app-loader');
    if (loader) loader.classList.remove('active');
  }

  // --- PART 4: Dashboard Count Animations ---
  static countUp(elementId, endValue, duration = 1500, prefix = '', suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const startValue = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (endValue - startValue) * ease);
      
      el.textContent = `${prefix}${current.toLocaleString()}${suffix}`;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = `${prefix}${endValue.toLocaleString()}${suffix}`;
      }
    }
    
    requestAnimationFrame(update);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  GSAnimation.init();
});
