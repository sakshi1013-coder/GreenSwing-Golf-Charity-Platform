/**
 * GreenSwing - Core Application JavaScript
 * Handles global functionality: navigation, animations, toasts, countdowns
 */

// ===== Toast System =====
class ToastManager {
  constructor() {
    this.container = document.getElementById('toast-container');
  }

  show(message, type = 'info', duration = 4000) {
    if (!this.container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
      <i class="${icons[type] || icons.info}" style="font-size: 1.2rem; color: var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'});"></i>
      <span style="flex: 1; font-size: 0.9rem;">${message}</span>
      <button style="background: none; color: var(--text-muted); font-size: 1rem; cursor: pointer;" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

const toast = new ToastManager();

// ===== Navigation =====
function initNavigation() {
  const nav = document.getElementById('main-nav');
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileClose = document.getElementById('mobile-nav-close');

  // Scroll effect
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  // Mobile menu
  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener('click', () => {
      mobileNav.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    if (mobileClose) {
      mobileClose.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    // Close on link click
    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ===== Counter Animation =====
function animateCounters() {
  const counters = document.querySelectorAll('[data-count]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 2000;
        const start = performance.now();

        function update(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          const current = Math.floor(eased * target);
          el.textContent = prefix + current.toLocaleString() + (suffix || '');
          
          if (progress < 1) {
            requestAnimationFrame(update);
          } else {
            el.textContent = prefix + target.toLocaleString() + (suffix || '');
          }
        }

        requestAnimationFrame(update);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(counter => observer.observe(counter));
}

// ===== Scroll Animations =====
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-up');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.section-header, .card, .card-glass, .step-card, .feature-card, .pricing-card, .testimonial-card, .impact-item').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// ===== Hero Particles =====
function initParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDuration = (3 + Math.random() * 4) + 's';
    particle.style.animationDelay = Math.random() * 3 + 's';
    particle.style.opacity = (0.1 + Math.random() * 0.3).toString();
    particle.style.width = (2 + Math.random() * 4) + 'px';
    particle.style.height = particle.style.width;
    container.appendChild(particle);
  }
}

// ===== Countdown Timer =====
function initCountdown() {
  const daysEl = document.getElementById('countdown-days');
  const hoursEl = document.getElementById('countdown-hours');
  const minsEl = document.getElementById('countdown-mins');
  const secsEl = document.getElementById('countdown-secs');

  if (!daysEl) return;

  // Set draw date to first of next month
  const now = new Date();
  const drawDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  function updateCountdown() {
    const now = new Date();
    const diff = drawDate - now;

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(mins).padStart(2, '0');
    secsEl.textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Also update "days to draw" in welcome banner
  const daysToDraw = document.getElementById('days-to-draw');
  if (daysToDraw) {
    const diff = drawDate - new Date();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    daysToDraw.textContent = `${days} days`;
  }
}

// ===== Sidebar Navigation (Dashboard/Admin) =====
function initSidebar() {
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
  const pages = document.querySelectorAll('.dashboard-page');
  const pageTitle = document.getElementById('current-page-title') || document.getElementById('admin-page-title');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  // Page switching
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = link.dataset.page;

      // Update active link
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Show target page
      pages.forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
      });

      const target = document.getElementById(`page-${targetPage}`);
      if (target) {
        target.style.display = 'block';
        target.classList.add('active');
      }

      // Update title
      if (pageTitle) {
        pageTitle.textContent = link.textContent.trim().replace(/\d+.*$/, '').trim();
      }

      // Close mobile sidebar
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.style.display = 'none';
      document.body.style.overflow = '';
    });
  });

  // Mobile sidebar toggle
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) {
        overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
      }
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      });
    }
  }
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  animateCounters();
  initScrollAnimations();
  initParticles();
  initCountdown();
  initSidebar();
});
