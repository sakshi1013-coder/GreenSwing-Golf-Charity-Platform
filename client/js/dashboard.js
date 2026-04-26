/**
 * GreenSwing - Dashboard JavaScript
 * Handles score management (FIFO), countdown, navigation, interactions
 *
 * Depends on: gsAuth.js (loaded before this file)
 */

// ── Auth guard: runs immediately, hides body until check passes ──
GsAuth.checkAuth();

document.addEventListener('DOMContentLoaded', function () {
  initDashboardData();
  initScoreManagement();
  initDashboardActions();
});

// ===== Data Management =====
let userScores = [
  { id: 1, score: 32, date: '2026-03-20' },
  { id: 2, score: 27, date: '2026-03-15' },
  { id: 3, score: 18, date: '2026-03-10' },
  { id: 4, score: 41, date: '2026-03-05' },
  { id: 5, score: 9, date: '2026-02-28' },
];

function initDashboardData() {
  // Load user data from the central auth session
  const user = GsAuth.getUser() || {};

  if (user.name) {
    const welcomeName = document.getElementById('welcome-name');
    const userName    = document.getElementById('user-name');
    const userEmail   = document.getElementById('user-email');
    const userAvatar  = document.getElementById('user-avatar');

    if (welcomeName) welcomeName.textContent = user.name.split(' ')[0];
    if (userName)    userName.textContent    = user.name;
    if (userEmail)   userEmail.textContent   = user.email;
    if (userAvatar) {
      userAvatar.textContent = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
  }

  // Load scores from localStorage if available
  const savedScores = localStorage.getItem('greenswing_scores');
  if (savedScores) {
    try { userScores = JSON.parse(savedScores); } catch (e) {}
  }

  renderAllScores();
  updateStats();
}

// ===== Score Management with FIFO =====
function initScoreManagement() {
  // Toggle add score form
  const addScoreBtn = document.getElementById('add-score-btn');
  const quickAddScore = document.getElementById('quick-add-score');
  const addScoreForm = document.getElementById('add-score-form');
  const cancelScoreBtn = document.getElementById('cancel-score-btn');
  const saveScoreBtn = document.getElementById('save-score-btn');
  const scoreInput = document.getElementById('new-score-input');

  function showAddForm() {
    if (addScoreForm) {
      addScoreForm.style.display = 'flex';
      if (scoreInput) scoreInput.focus();
    }
  }

  function hideAddForm() {
    if (addScoreForm) {
      addScoreForm.style.display = 'none';
      if (scoreInput) scoreInput.value = '';
    }
  }

  if (addScoreBtn) addScoreBtn.addEventListener('click', showAddForm);
  if (quickAddScore) {
    quickAddScore.addEventListener('click', (e) => {
      e.preventDefault();
      showAddForm();
      // Scroll to scores section
      document.querySelector('.score-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (cancelScoreBtn) cancelScoreBtn.addEventListener('click', hideAddForm);

  // Save score (FIFO - only keep latest 5)
  if (saveScoreBtn) {
    saveScoreBtn.addEventListener('click', () => {
      const value = parseInt(scoreInput?.value);

      if (!value || value < 1 || value > 45) {
        toast.show('Score must be between 1 and 45 (Stableford)', 'error');
        return;
      }

      // FIFO: Add new score, remove oldest if > 5
      const newScore = {
        id: Date.now(),
        score: value,
        date: new Date().toISOString().split('T')[0]
      };

      userScores.unshift(newScore);

      // Keep only latest 5
      if (userScores.length > 5) {
        const removed = userScores.pop();
        toast.show(`Score ${value} added! Oldest score (${removed.score}) removed (FIFO).`, 'success');
      } else {
        toast.show(`Score ${value} added successfully!`, 'success');
      }

      saveScores();
      renderAllScores();
      updateStats();
      hideAddForm();
      const badge = document.getElementById('draw-badge');
      if (badge) badge.style.display = '';
    });
  }

  // Scores Page Add Button
  const scoresPageAddBtn = document.getElementById('scores-page-add');
  if (scoresPageAddBtn) {
    scoresPageAddBtn.addEventListener('click', () => {
      const value = prompt('Enter new Stableford score (1-45):');
      if (value === null) return;
      const parsed = parseInt(value);
      if (!parsed || parsed < 1 || parsed > 45) {
        toast.show('Score must be between 1 and 45 (Stableford)', 'error');
        return;
      }
      
      const newScore = {
        id: Date.now(),
        score: parsed,
        date: new Date().toISOString().split('T')[0]
      };

      userScores.unshift(newScore);

      if (userScores.length > 5) {
        const removed = userScores.pop();
        toast.show(`Score ${parsed} added! Oldest score (${removed.score}) removed (FIFO).`, 'success');
      } else {
        toast.show(`Score ${parsed} added successfully!`, 'success');
      }

      saveScores();
      renderAllScores();
      updateStats();
      
      const badge = document.getElementById('draw-badge');
      if (badge) badge.style.display = '';
    });
  }

  // Enter key to save
  if (scoreInput) {
    scoreInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveScoreBtn?.click();
      }
    });
  }
}

function saveScores() {
  localStorage.setItem('greenswing_scores', JSON.stringify(userScores));
}

function renderAllScores() {
  renderScoresList('scores-list');
  renderScoresList('scores-page-list');
  
  // Render Draw Center balls
  const drawBallsContainer = document.getElementById('draw-center-balls');
  if (drawBallsContainer) {
    if (userScores.length === 0) {
      drawBallsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No scores added yet. Add a score to get your entry numbers.</div>';
    } else {
      drawBallsContainer.innerHTML = userScores.reduce((acc, score) => {
        return acc + `<div class="score-ball" style="width: 56px; height: 56px; font-size: 1.25rem; animation: scaleIn 0.3s ease-out forwards;">${score.score}</div>`;
      }, '');
    }
  }
}

function renderScoresList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (userScores.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⛳</div>
        <h4>No Scores Yet</h4>
        <p>Add your first Stableford score to get started with monthly draws!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = userScores.map((score, index) => `
    <div class="score-item" data-id="${score.id}" style="animation: fadeUp 0.3s ease-out ${index * 0.1}s both;">
      <div class="score-rank">${index + 1}</div>
      <div class="score-value-display">${score.score}</div>
      <div class="score-details">
        <div class="score-date">${formatDate(score.date)}</div>
      </div>
      <div class="score-actions">
        <button class="score-action-btn" title="Edit" onclick="editScore(${score.id})">
          <i class="fas fa-pen"></i>
        </button>
        <button class="score-action-btn delete" title="Delete" onclick="deleteScore(${score.id})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function editScore(id) {
  const score = userScores.find(s => s.id === id);
  if (!score) return;

  const newValue = prompt(`Edit score (current: ${score.score}, range: 1-45):`, score.score);
  if (newValue === null) return;

  const parsed = parseInt(newValue);
  if (!parsed || parsed < 1 || parsed > 45) {
    toast.show('Score must be between 1 and 45', 'error');
    return;
  }

  score.score = parsed;
  saveScores();
  renderAllScores();
  updateStats();
  toast.show('Score updated!', 'success');
}

function deleteScore(id) {
  if (!confirm('Delete this score?')) return;
  
  userScores = userScores.filter(s => s.id !== id);
  saveScores();
  renderAllScores();
  updateStats();
  toast.show('Score deleted', 'info');
}

// Make functions available globally
window.editScore = editScore;
window.deleteScore = deleteScore;

function updateStats() {
  if (userScores.length === 0) {
    const avgEl = document.getElementById('stat-avg-score');
    if (avgEl) avgEl.textContent = '0';
    
    document.getElementById('stats-page-avg') && (document.getElementById('stats-page-avg').textContent = '0');
    document.getElementById('stats-page-highest') && (document.getElementById('stats-page-highest').textContent = '0');
    document.getElementById('stats-page-lowest') && (document.getElementById('stats-page-lowest').textContent = '0');
    return;
  }

  const avg = Math.round(userScores.reduce((sum, s) => sum + s.score, 0) / userScores.length);
  const highest = Math.max(...userScores.map(s => s.score));
  const lowest = Math.min(...userScores.map(s => s.score));
  
  const avgEl = document.getElementById('stat-avg-score');
  if (avgEl && typeof GSAnimation !== 'undefined') {
    GSAnimation.countUp('stat-avg-score', avg);
  } else if (avgEl) {
    avgEl.textContent = avg;
  }
  
  if (typeof GSAnimation !== 'undefined') {
    GSAnimation.countUp('stats-page-avg', avg);
    GSAnimation.countUp('stats-page-highest', highest);
    GSAnimation.countUp('stats-page-lowest', lowest);
  } else {
    document.getElementById('stats-page-avg') && (document.getElementById('stats-page-avg').textContent = avg);
    document.getElementById('stats-page-highest') && (document.getElementById('stats-page-highest').textContent = highest);
    document.getElementById('stats-page-lowest') && (document.getElementById('stats-page-lowest').textContent = lowest);
  }
}

// Called after fade in
function initDashboardAnimations() {
  if (typeof GSAnimation !== 'undefined') {
    GSAnimation.countUp('stat-winnings', 480, 2000, '£');
    GSAnimation.countUp('stat-charity', 24, 2000, '£');
    GSAnimation.countUp('stat-draws', 6, 2000);
    
    // Add slide in from side animation to sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth > 768) {
      sidebar.animate([
        { transform: 'translateX(-100%)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 }
      ], {
        duration: 600,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'both'
      });
    }
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// ===== Dashboard Actions =====
function initDashboardActions() {
  // View Draw button
  const viewDrawBtn = document.getElementById('view-draw-btn');
  if (viewDrawBtn) {
    viewDrawBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Navigate to draws page
      const drawLink = document.querySelector('.sidebar-link[data-page="draws"]');
      if (drawLink) drawLink.click();
    });
  }

  // View all winnings
  const viewAllWinnings = document.getElementById('view-all-winnings');
  if (viewAllWinnings) {
    viewAllWinnings.addEventListener('click', () => {
      const winningsLink = document.querySelector('.sidebar-link[data-page="winnings"]');
      if (winningsLink) winningsLink.click();
    });
  }

  // Change charity
  const changeCharityBtn = document.getElementById('change-charity-btn');
  if (changeCharityBtn) {
    changeCharityBtn.addEventListener('click', () => {
      const charityLink = document.querySelector('.sidebar-link[data-page="charities"]');
      if (charityLink) charityLink.click();
    });
  }

  // Save settings
  const saveSettings = document.getElementById('save-settings');
  if (saveSettings) {
    saveSettings.addEventListener('click', () => {
      toast.show('Settings saved successfully!', 'success');
    });
  }

  // Cancel subscription
  const cancelSub = document.getElementById('cancel-subscription');
  if (cancelSub) {
    cancelSub.addEventListener('click', () => {
      if (confirm('Are you sure you want to cancel your subscription? You will lose access to monthly draws.')) {
        toast.show('Subscription cancellation request submitted', 'warning');
      }
    });
  }

  // Logout — use GsAuth.logout() to properly clear session
  const logoutBtn = document.getElementById('sidebar-user');
  if (logoutBtn) {
    logoutBtn.title = 'Click to sign out';
    logoutBtn.style.cursor = 'pointer';
    logoutBtn.addEventListener('click', function () {
      if (confirm('Sign out of GreenSwing?')) {
        GsAuth.logout();
      }
    });
  }

  // Also wire up a dedicated logout button if it exists
  const logoutBtnDedicated = document.getElementById('logout-btn');
  if (logoutBtnDedicated) {
    logoutBtnDedicated.addEventListener('click', function () {
      GsAuth.logout();
    });
  }
}
