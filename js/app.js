/* ============================================
   LEARN WITH MS. THÚY - MAIN APP (index.html)
   ============================================ */

'use strict';

// ---------- STATE ----------
const state = {
  articles: [],
  filtered: [],
  currentPage: 1,
  pageSize: 10,
  searchQuery: '',
  levelFilter: 'all',
  debounceTimer: null
};

// ---------- DOM ELEMENTS ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const searchInput = $('#search-input');
const cardGrid = $('#card-grid');
const skeletonGrid = $('#skeleton-grid');
const emptyState = $('#empty-state');
const pagination = $('#pagination');
const themeToggle = $('#theme-toggle');
const hamburger = $('#hamburger');
const nav = $('#nav');
const backToTop = $('#back-to-top');
const continueSection = $('#continue-section');
const continueList = $('#continue-reading-list');

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', init);

async function init() {
  initTheme();
  initScrollEffects();
  initNav();
  initSearch();
  initFilters();
  initBackToTop();

  await loadArticles();
  renderContinueReading();
}

// ---------- THEME ----------
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    enableDarkMode();
  }

  themeToggle.addEventListener('click', toggleTheme);
}

function toggleTheme() {
  if (document.body.classList.contains('dark-mode')) {
    disableDarkMode();
    localStorage.setItem('theme', 'light');
  } else {
    enableDarkMode();
    localStorage.setItem('theme', 'dark');
  }
}

function enableDarkMode() {
  document.body.classList.add('dark-mode');
  $('#dark-css').removeAttribute('disabled');
}

function disableDarkMode() {
  document.body.classList.remove('dark-mode');
  $('#dark-css').setAttribute('disabled', '');
}

// ---------- SCROLL EFFECTS ----------
function initScrollEffects() {
  const header = $('#header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// ---------- NAVIGATION ----------
function initNav() {
  hamburger.addEventListener('click', () => {
    nav.classList.toggle('open');
    const expanded = nav.classList.contains('open');
    hamburger.setAttribute('aria-expanded', expanded);
  });

  // Close nav on link click (mobile)
  nav.addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-link')) {
      nav.classList.remove('open');
    }
  });
}

// ---------- BACK TO TOP ----------
function initBackToTop() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---------- LOAD ARTICLES ----------
async function loadArticles() {
  try {
    const response = await fetch('data/articles.json');
    if (!response.ok) throw new Error('Failed to load articles');
    state.articles = await response.json();
    state.filtered = [...state.articles];
    renderArticles();
  } catch (err) {
    console.error('Error loading articles:', err);
    showToast('Không thể tải danh sách bài viết!', 'error');
    skeletonGrid.style.display = 'none';
    emptyState.style.display = 'block';
  }
}

// ---------- SEARCH ----------
function initSearch() {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      state.currentPage = 1;
      applyFilters();
    }, 300); // Debounce 300ms
  });
}

// ---------- FILTERS ----------
function initFilters() {
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.levelFilter = btn.dataset.level;
      state.currentPage = 1;
      applyFilters();
    });
  });
}

function applyFilters() {
  state.filtered = state.articles.filter(article => {
    // Level filter
    if (state.levelFilter !== 'all' && article.level !== state.levelFilter) {
      return false;
    }

    // Search filter
    if (state.searchQuery) {
      const query = state.searchQuery;
      const searchable = [
        article.title,
        article.description,
        article.level,
        ...(article.tags || [])
      ].join(' ').toLowerCase();

      return searchable.includes(query);
    }

    return true;
  });

  renderArticles();
}

// ---------- RENDER ARTICLES ----------
function renderArticles() {
  skeletonGrid.style.display = 'none';

  if (state.filtered.length === 0) {
    cardGrid.style.display = 'none';
    emptyState.style.display = 'block';
    pagination.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  cardGrid.style.display = 'grid';

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageItems = state.filtered.slice(start, end);

  cardGrid.innerHTML = pageItems.map(article => createArticleCard(article)).join('');

  // Add click handlers
  cardGrid.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      trackRecentlyViewed(id);
      window.location.href = `reading.html?id=${id}`;
    });

    // Keyboard accessibility
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  // Ripple effect on buttons
  cardGrid.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.article-card');
      card.click();
    });
  });

  renderPagination();
}

function createArticleCard(article) {
  const tags = (article.tags || []).map(tag =>
    `<span class="card-tag">${escapeHtml(tag)}</span>`
  ).join('');

  return `
    <article class="article-card" data-id="${article.id}" aria-label="${escapeHtml(article.title)}">
      <div class="card-thumbnail-wrapper">
        <img class="card-thumbnail"
             src="${escapeHtml(article.thumbnail)}"
             alt="${escapeHtml(article.title)}"
             loading="lazy"
             onerror="this.style.background='var(--gradient-primary)';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22><text x=%2250%%22 y=%2250%%22 font-size=%2260%22 text-anchor=%22middle%22 dy=%22.3em%22>📚</text></svg>'" />
        <span class="card-level-badge" data-level="${article.level}">${article.level}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(article.title)}</h3>
        <p class="card-description">${escapeHtml(article.description)}</p>
        <div class="card-tags">${tags}</div>
        <div class="card-meta">
          <span>⏱ ${escapeHtml(article.readingTime)}</span>
          <span>❓ ${article.questions} questions</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-start" aria-label="Start reading ${escapeHtml(article.title)}">
          Start Reading →
        </button>
      </div>
    </article>
  `;
}

// ---------- PAGINATION ----------
function renderPagination() {
  const totalPages = Math.ceil(state.filtered.length / state.pageSize);

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // Previous
  html += `<button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} data-page="${state.currentPage - 1}">← Prev</button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="page-btn" style="cursor:default;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-btn" style="cursor:default;">...</span>`;
    html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next
  html += `<button class="page-btn" ${state.currentPage === totalPages ? 'disabled' : ''} data-page="${state.currentPage + 1}">Next →</button>`;

  pagination.innerHTML = html;

  // Add click handlers
  pagination.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      state.currentPage = parseInt(btn.dataset.page);
      renderArticles();
      document.getElementById('articles').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ---------- CONTINUE READING ----------
function renderContinueReading() {
  const recent = getRecentlyViewed();
  if (recent.length === 0) {
    continueSection.style.display = 'none';
    return;
  }

  continueSection.style.display = 'block';

  const recentArticles = recent
    .map(id => state.articles.find(a => a.id === id))
    .filter(a => a)
    .slice(0, 4);

  continueList.innerHTML = recentArticles.map(article => createArticleCard(article)).join('');

  continueList.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `reading.html?id=${card.dataset.id}`;
    });
  });
}

// ---------- RECENTLY VIEWED ----------
function getRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  } catch {
    return [];
  }
}

function trackRecentlyViewed(id) {
  let recent = getRecentlyViewed();
  recent = recent.filter(x => x !== id);
  recent.unshift(id);
  recent = recent.slice(0, 20);
  localStorage.setItem('recentlyViewed', JSON.stringify(recent));
}

// ---------- TOAST ----------
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- UTILITIES ----------
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
