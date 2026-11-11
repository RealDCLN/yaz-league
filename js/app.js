/**
 * YAZ LEAGUE — Main Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Background Globe
  if (typeof initBackgroundGlobe === 'function') {
    initBackgroundGlobe();
  }

  // Navbar Links / Smooth Scroll Navigation
  setupNavigation();

  // Load Data from Supabase / Local Fallbacks
  loadStandings();
  loadSchedule();
  loadTeams();
  loadStats();
});

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId.startsWith('#')) {
        e.preventDefault();

        // Update active class
        navLinks.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');

        // Smooth scroll to section
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

async function loadStandings() {
  const tbody = document.getElementById('standings-tbody');
  if (!tbody) return;

  try {
    let standings = [];
    if (window.yazData && typeof window.yazData.fetchStandings === 'function') {
      standings = await window.yazData.fetchStandings();
    }

    if (!standings || standings.length === 0) {
      standings = getFallbackStandings();
    }

    renderStandings(standings);
  } catch (err) {
    console.warn('Using fallback standings data.', err);
    renderStandings(getFallbackStandings());
  }
}

function renderStandings(teams) {
  const tbody = document.getElementById('standings-tbody');
  if (!tbody) return;

  tbody.innerHTML = teams
    .map(
      (t, index) => `
    <tr>
      <td class="text-center"><strong>${index + 1}</strong></td>
      <td><strong>${t.name}</strong></td>
      <td class="text-center">${t.played || 0}</td>
      <td class="text-center">${t.wins || 0}</td>
      <td class="text-center">${t.losses || 0}</td>
      <td class="text-center">${t.points_for || 0}</td>
      <td class="text-center">${(t.points_for || 0) - (t.points_against || 0)}</td>
      <td class="text-center"><strong>${t.pts_total || t.wins * 2 + t.losses}</strong></td>
    </tr>
  `
    )
    .join('');
}

async function loadSchedule() {
  const container = document.getElementById('schedule-container');
  if (!container) return;

  try {
    let matches = [];
    if (window.yazData && typeof window.yazData.fetchSchedule === 'function') {
      matches = await window.yazData.fetchSchedule();
    }

    if (!matches || matches.length === 0) {
      matches = getFallbackSchedule();
    }

    renderSchedule(matches);
  } catch (err) {
    renderSchedule(getFallbackSchedule());
  }
}

function renderSchedule(matches) {
  const container = document.getElementById('schedule-container');
  if (!container) return;

  container.innerHTML = matches
    .map(
      (m) => `
    <div class="match-card">
      <div class="match-header">
        <span><i class="fa-solid fa-calendar"></i> ${m.date || 'TBD'}</span>
        <span>${m.status || 'SCHEDULED'}</span>
      </div>
      <div class="match-teams">
        <div class="match-team">
          <span>${m.team_home}</span>
          <span class="match-score">${m.score_home !== null ? m.score_home : '-'}</span>
        </div>
        <div class="match-team">
          <span>${m.team_away}</span>
          <span class="match-score">${m.score_away !== null ? m.score_away : '-'}</span>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

async function loadTeams() {
  const container = document.getElementById('teams-container');
  if (!container) return;

  try {
    let teams = [];
    if (window.yazData && typeof window.yazData.fetchTeams === 'function') {
      teams = await window.yazData.fetchTeams();
    }

    if (!teams || teams.length === 0) {
      teams = getFallbackStandings();
    }

    container.innerHTML = teams
      .map(
        (t) => `
      <div class="team-card">
        <div class="team-logo-placeholder">
          <i class="fa-solid fa-basketball"></i>
        </div>
        <h3>${t.name}</h3>
        <p style="color: var(--text-dim); font-size: 0.85rem; margin-top: 0.25rem;">
          ${t.wins || 0}W - ${t.losses || 0}L
        </p>
      </div>
    `
      )
      .join('');
  } catch (err) {
    console.error('Error loading teams:', err);
  }
}

async function loadStats() {
  if (window.yazStats && typeof window.yazStats.renderLeaders === 'function') {
    window.yazStats.renderLeaders();
  }
}

/* Fallback Local Data Mock */
function getFallbackStandings() {
  return [
    { name: 'YAZ Ballers', played: 5, wins: 5, losses: 0, points_for: 380, points_against: 310, pts_total: 10 },
    { name: 'Crete Hoopers', played: 5, wins: 4, losses: 1, points_for: 365, points_against: 330, pts_total: 9 },
    { name: 'Heraklion Kings', played: 5, wins: 3, losses: 2, points_for: 340, points_against: 345, pts_total: 8 },
    { name: 'Aegean Dunkers', played: 5, wins: 1, losses: 4, points_for: 310, points_against: 360, pts_total: 6 },
    { name: 'Coast Guards', played: 5, wins: 0, losses: 5, points_for: 295, points_against: 345, pts_total: 5 }
  ];
}

function getFallbackSchedule() {
  return [
    { date: '15 Ιουλ 2026', team_home: 'YAZ Ballers', score_home: 78, team_away: 'Crete Hoopers', score_away: 72, status: 'FINAL' },
    { date: '18 Ιουλ 2026', team_home: 'Heraklion Kings', score_home: 65, team_away: 'Aegean Dunkers', score_away: 60, status: 'FINAL' },
    { date: '22 Ιουλ 2026', team_home: 'Coast Guards', score_home: null, team_away: 'YAZ Ballers', score_away: null, status: 'UPCOMING' }
  ];
}