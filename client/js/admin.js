/**
 * GreenSwing - Admin Panel JavaScript
 * Handles draw engine, user management, winner verification, analytics
 *
 * Depends on: gsAuth.js (loaded before this file)
 */

// ── Admin-only auth guard ──
GsAuth.checkAuth(true);

document.addEventListener('DOMContentLoaded', function () {
  // Populate admin user info from session
  var u = GsAuth.getUser();
  if (u) {
    var nameEl   = document.getElementById('user-name');
    var emailEl  = document.getElementById('user-email');
    var avatarEl = document.getElementById('user-avatar');
    if (nameEl)   nameEl.textContent   = u.name  || 'Admin';
    if (emailEl)  emailEl.textContent  = u.email || 'admin@greenswing.com';
    if (avatarEl) avatarEl.textContent = u.name
      ? u.name.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase()
      : 'AD';
  }

  initAdminDrawEngine();
  initAdminUserTable();
  initAdminFilters();
  initAdminActions();
  initAdminLogout();
});

// ===== Draw Engine =====
function initAdminDrawEngine() {
  const runDrawBtn = document.getElementById('run-draw-btn');
  const drawResults = document.getElementById('draw-results');
  const publishBtn = document.getElementById('publish-draw-btn');

  if (!runDrawBtn) return;

  runDrawBtn.addEventListener('click', () => {
    runDrawBtn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px;"></span> Running draw...';
    runDrawBtn.disabled = true;

    // Generate 5 random numbers between 1-45 (Stableford range)
    const winningNumbers = generateDrawNumbers();

    // Animate balls one by one
    let delay = 500;
    winningNumbers.forEach((num, i) => {
      setTimeout(() => {
        const ball = document.getElementById(`draw-ball-${i + 1}`);
        if (ball) {
          ball.textContent = num;
          ball.style.animation = 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        }

        // Show results when all balls revealed
        if (i === 4) {
          setTimeout(() => {
            if (drawResults) drawResults.style.display = 'block';
            
            // Find winners (simulated)
            const winners = simulateWinners(winningNumbers);
            const summaryEl = document.getElementById('draw-winners-summary');
            
            if (summaryEl) {
              summaryEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-top: var(--space-md);">
                  <div style="padding: var(--space-md); background: rgba(245, 158, 11, 0.1); border-radius: var(--radius-md);">
                    <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--accent-400);">${winners.fiveMatch}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">5-Match Winners</div>
                  </div>
                  <div style="padding: var(--space-md); background: rgba(16, 185, 129, 0.1); border-radius: var(--radius-md);">
                    <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--primary-400);">${winners.fourMatch}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">4-Match Winners</div>
                  </div>
                  <div style="padding: var(--space-md); background: rgba(59, 130, 246, 0.1); border-radius: var(--radius-md);">
                    <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--info);">${winners.threeMatch}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">3-Match Winners</div>
                  </div>
                </div>
                ${winners.fiveMatch === 0 ? '<p style="margin-top: var(--space-md); font-size: 0.9rem; color: var(--accent-400);"><i class="fas fa-arrow-rotate-right"></i> No 5-match winners — jackpot rolls over to next month!</p>' : ''}
              `;
            }

            runDrawBtn.innerHTML = '<i class="fas fa-check"></i> Draw Complete';
            runDrawBtn.style.background = 'var(--gradient-primary)';
            toast.show('Draw completed! Winning numbers generated.', 'success');
          }, 500);
        }
      }, delay * (i + 1));
    });
  });

  // Publish results
  if (publishBtn) {
    publishBtn.addEventListener('click', () => {
      publishBtn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px;"></span> Publishing...';
      publishBtn.disabled = true;

      setTimeout(() => {
        publishBtn.innerHTML = '<i class="fas fa-check"></i> Published!';
        publishBtn.style.background = 'var(--gradient-primary)';
        toast.show('Draw results published to all members!', 'success');
      }, 1500);
    });
  }
}

function generateDrawNumbers() {
  const numbers = new Set();
  while (numbers.size < 5) {
    numbers.add(Math.floor(Math.random() * 45) + 1);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

function simulateWinners(winningNumbers) {
  // Realistic simulation: 5-match is very rare
  return {
    fiveMatch: Math.random() < 0.05 ? 1 : 0,  // 5% chance
    fourMatch: Math.floor(Math.random() * 4) + 1,    // 1-4 winners
    threeMatch: Math.floor(Math.random() * 15) + 5    // 5-19 winners
  };
}

// ===== Admin User Table =====
function initAdminUserTable() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  const demoUsers = [
    { name: 'James Mitchell', email: 'james@email.com', plan: 'Yearly', status: 'Active', scores: '5/5', charity: '🌍 Green Earth', donated: '£89.99', joined: 'Jan 12, 2026', initials: 'JM', color: 'var(--gradient-primary)' },
    { name: 'Sarah Parker', email: 'sarah@email.com', plan: 'Monthly', status: 'Active', scores: '3/5', charity: '🏥 Health Heroes', donated: '£29.97', joined: 'Dec 3, 2025', initials: 'SP', color: 'var(--gradient-accent)' },
    { name: 'Robert Khan', email: 'robert@email.com', plan: 'Yearly', status: 'Expiring', scores: '5/5', charity: '📚 Future Minds', donated: '£89.99', joined: 'Nov 18, 2025', initials: 'RK', color: 'linear-gradient(135deg, #ec4899, #f472b6)' },
    { name: 'Emily Wilson', email: 'emily@email.com', plan: 'Monthly', status: 'Active', scores: '5/5', charity: '🐾 Paws & Claws', donated: '£49.95', joined: 'Feb 1, 2026', initials: 'EW', color: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
    { name: 'David Chen', email: 'david@email.com', plan: 'Yearly', status: 'Active', scores: '4/5', charity: '🌊 Ocean Guard', donated: '£89.99', joined: 'Jan 28, 2026', initials: 'DC', color: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
    { name: 'Lisa Thompson', email: 'lisa@email.com', plan: 'Monthly', status: 'Cancelled', scores: '2/5', charity: '⚽ Youth Sports', donated: '£19.98', joined: 'Oct 5, 2025', initials: 'LT', color: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  ];

  tbody.innerHTML = demoUsers.map(user => `
    <tr>
      <td>
        <div class="table-user">
          <div class="table-avatar" style="background: ${user.color};">${user.initials}</div>
          <div>
            <div class="table-user-name">${user.name}</div>
            <div class="table-user-email">${user.email}</div>
          </div>
        </div>
      </td>
      <td>${user.plan}</td>
      <td><span class="badge badge-${user.status === 'Active' ? 'success' : user.status === 'Expiring' ? 'warning' : 'error'}">${user.status}</span></td>
      <td>${user.scores}</td>
      <td>${user.charity}</td>
      <td class="amount">${user.donated}</td>
      <td>${user.joined}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn" title="View"><i class="fas fa-eye"></i></button>
          <button class="table-action-btn" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="table-action-btn reject" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ===== Filter Chips =====
function initAdminFilters() {
  document.querySelectorAll('.admin-table-filters').forEach(filterGroup => {
    filterGroup.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        toast.show(`Filter: ${chip.textContent} applied`, 'info');
      });
    });
  });
}

// ===== Admin Actions =====
function initAdminActions() {
  // Approve winner
  const approveBtn = document.getElementById('approve-winner-1');
  if (approveBtn) {
    approveBtn.addEventListener('click', () => {
      const card = approveBtn.closest('.verification-card');
      if (card) {
        card.style.animation = 'fadeIn 0.3s ease-out reverse';
        setTimeout(() => {
          card.style.display = 'none';
          toast.show('Winner approved! Payment processing started.', 'success');
        }, 300);
      }
    });
  }

  // Reject winner
  const rejectBtn = document.getElementById('reject-winner-1');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reject this winner? This action cannot be undone.')) {
        const card = rejectBtn.closest('.verification-card');
        if (card) {
          card.style.display = 'none';
          toast.show('Winner rejected. User has been notified.', 'error');
        }
      }
    });
  }

  // Add charity button
  const addCharityBtn = document.getElementById('add-charity-btn');
  if (addCharityBtn) {
    addCharityBtn.addEventListener('click', () => {
      toast.show('Charity form would open here (connect to backend)', 'info');
    });
  }

  // Mini chart bar hover effects
  document.querySelectorAll('.mini-chart-bar').forEach(function (bar) {
    bar.style.cursor = 'pointer';
    bar.addEventListener('mouseenter', function() {
      this.style.transform = 'scaleY(1.05)';
    });
    bar.addEventListener('mouseleave', function() {
      this.style.transform = 'scaleY(1)';
    });
  });
}

// ── Admin logout ──
function initAdminLogout() {
  // Wire any element with id="admin-logout" or id="sidebar-user"
  ['admin-logout', 'sidebar-user', 'logout-btn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', function () {
      if (confirm('Sign out of Admin Panel?')) {
        GsAuth.logout();
      }
    });
  });
}
