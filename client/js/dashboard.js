/**
 * GreenSwing - Dashboard JavaScript
 * Handles score management (FIFO), countdown, navigation, interactions
 */

document.addEventListener('DOMContentLoaded', () => {
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
  // Load user data
  const user = JSON.parse(localStorage.getItem('greenswing_user') || '{}');
  
  if (user.name) {
    const welcomeName = document.getElementById('welcome-name');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');

    if (welcomeName) welcomeName.textContent = user.name.split(' ')[0];
    if (userName) userName.textContent = user.name;
    if (userEmail) userEmail.textContent = user.email;
    if (userAvatar) {
      userAvatar.textContent = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
  }

  // Load scores from localStorage if available
  const savedScores = localStorage.getItem('greenswing_scores');
  if (savedScores) {
    userScores = JSON.parse(savedScores);
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
  if (userScores.length === 0) return;

  const avg = Math.round(userScores.reduce((sum, s) => sum + s.score, 0) / userScores.length);
  
  const avgEl = document.getElementById('stat-avg-score');
  if (avgEl) avgEl.textContent = avg;
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

  // Logout
  const logoutBtn = document.getElementById('sidebar-user');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Sign out of GreenSwing?')) {
        localStorage.removeItem('greenswing_user');
        window.location.href = '../index.html';
      }
    });
  }
}
