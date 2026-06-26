/* ============================================
   LEARN WITH MS. THÚY - READING PAGE
   ============================================ */

'use strict';

// ---------- GLOBAL STATE ----------
const state = {
  articleId: null,
  article: null,
  answers: {},
  userAnswers: {},
  checked: false,
  score: { correct: 0, total: 0, points: 0 },
  timer: { start: null, interval: null, elapsed: 0 },
  pdf: {
    doc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.5,
    rendering: false,
    highlightMode: false,
    highlights: []
  },
  history: []
};

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get article ID from URL
  const params = new URLSearchParams(window.location.search);
  state.articleId = params.get('id');

  if (!state.articleId) {
    showToast('Không tìm thấy bài viết!', 'error');
    setTimeout(() => window.location.href = 'index.html', 1500);
    return;
  }

  initTheme();
  initMobileTabs();
  initResizer();
  initScoreboard();
  initButtons();
  initKeyboard();

  await loadArticle();
}

// ---------- THEME ----------
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    $('#dark-css').removeAttribute('disabled');
  }

  $('#theme-toggle').addEventListener('click', () => {
    if (document.body.classList.contains('dark-mode')) {
      document.body.classList.remove('dark-mode');
      $('#dark-css').setAttribute('disabled', '');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.add('dark-mode');
      $('#dark-css').removeAttribute('disabled');
      localStorage.setItem('theme', 'dark');
    }
  });
}

// ---------- MOBILE TABS ----------
function initMobileTabs() {
  $$('.mobile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.mobile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      $('.split-left').classList.toggle('mobile-active', target === 'pdf');
      $('.split-right').classList.toggle('mobile-active', target === 'questions');
    });
  });

  // Default: show PDF on mobile
  if (window.innerWidth <= 768) {
    $('.split-left').classList.add('mobile-active');
  }
}

// ---------- RESIZER ----------
function initResizer() {
  const resizer = $('#split-resizer');
  const left = $('#split-left');
  const right = $('#split-right');
  const container = $('#split-container');

  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const containerRect = container.getBoundingClientRect();
    const percent = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (percent > 20 && percent < 80) {
      left.style.flex = `0 0 ${percent}%`;
      right.style.flex = `0 0 ${100 - percent - 1}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// ---------- LOAD ARTICLE ----------
async function loadArticle() {
  try {
    // Load metadata
    const metaRes = await fetch('data/articles.json');
    const articles = await metaRes.json();
    const meta = articles.find(a => a.id === state.articleId);

    if (!meta) throw new Error('Article not found');

    // Load article JSON
    const res = await fetch(meta.json);
    if (!res.ok) throw new Error('Failed to load article data');
    state.article = await res.json();

    // Update UI
    $('#article-title').textContent = state.article.title;
    $('#article-level').textContent = state.article.level;
    $('#article-level').style.background = getLevelColor(state.article.level);
    document.title = `${state.article.title} - Learn with Ms. Thúy`;

    // Load saved state
    loadSavedState();

    // Load PDF
    await loadPDF(state.article.pdf);

    // Render questions
    renderQuestions();

    // Start timer
    startTimer();

    // Update bookmark/favorite UI
    updateBookmarkUI();
    updateFavoriteUI();

  } catch (err) {
    console.error('Error loading article:', err);
    showToast('Không thể tải bài viết!', 'error');
    setTimeout(() => window.location.href = 'index.html', 1500);
  }
}

function getLevelColor(level) {
  const colors = {
    'A1': '#48bb78', 'A2': '#38b2ac', 'B1': '#4299e1',
    'B2': '#667eea', 'C1': '#9f7aea', 'C2': '#ed64a6'
  };
  return colors[level] || '#667eea';
}

// ---------- PDF.JS ----------
async function loadPDF(url) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  try {
    state.pdf.doc = await pdfjsLib.getDocument(url).promise;
    state.pdf.totalPages = state.pdf.doc.numPages;
    state.pdf.currentPage = 1;

    $('#pdf-page-count').textContent = state.pdf.totalPages;
    $('#pdf-page-input').max = state.pdf.totalPages;

    renderPDFPage();
    initPDFControls();
    initHighlight();

  } catch (err) {
    console.error('Error loading PDF:', err);
    $('#pdf-canvas-wrapper').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:4rem;margin-bottom:16px;">📄</div>
        <h3>Không thể tải PDF</h3>
        <p>Vui lòng kiểm tra đường dẫn file PDF.</p>
        <p style="font-size:0.85rem;margin-top:8px;opacity:0.7;">${url}</p>
      </div>
    `;
  }
}
async function renderPDFPage() {
  if (state.pdf.rendering) return;
  state.pdf.rendering = true;

  try {
    const page = await state.pdf.doc.getPage(state.pdf.currentPage);
    const viewport = page.getViewport({ scale: state.pdf.scale });

    const canvas = $('#pdf-canvas');
    if (!canvas) {
      console.error('PDF canvas not found');
      return;
    }

    const context = canvas.getContext('2d');

    // High DPI rendering
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    // Highlight canvas
    const hCanvas = $('#pdf-highlight-canvas');
    if (hCanvas) {
      hCanvas.width = canvas.width;
      hCanvas.height = canvas.height;
      hCanvas.style.width = canvas.style.width;
      hCanvas.style.height = canvas.style.height;
      hCanvas.style.top = '20px';
      hCanvas.style.left = '50%';
      hCanvas.style.transform = 'translateX(-50%)';
    }

    const transform = outputScale !== 1
      ? [outputScale, 0, 0, outputScale, 0, 0]
      : null;

    await page.render({
      canvasContext: context,
      transform: transform,
      viewport: viewport
    }).promise;

    // Update UI
    $('#pdf-page-input').value = state.pdf.currentPage;
    $('#zoom-level').textContent = Math.round(state.pdf.scale * 100) + '%';

    const progress = (state.pdf.currentPage / state.pdf.totalPages) * 100;
    $('#pdf-progress-bar').style.width = progress + '%';

    // Redraw highlights
    redrawHighlights();

  } catch (err) {
    console.error('Error rendering page:', err);
  } finally {
    state.pdf.rendering = false;
  }
}
function initPDFControls() {
  $('#pdf-prev').addEventListener('click', () => {
    if (state.pdf.currentPage > 1) {
      state.pdf.currentPage--;
      renderPDFPage();
    }
  });

  $('#pdf-next').addEventListener('click', () => {
    if (state.pdf.currentPage < state.pdf.totalPages) {
      state.pdf.currentPage++;
      renderPDFPage();
    }
  });

  $('#pdf-page-input').addEventListener('change', (e) => {
    let page = parseInt(e.target.value);
    if (page < 1) page = 1;
    if (page > state.pdf.totalPages) page = state.pdf.totalPages;
    state.pdf.currentPage = page;
    renderPDFPage();
  });

  $('#pdf-zoom-in').addEventListener('click', () => {
    state.pdf.scale = Math.min(4, state.pdf.scale + 0.25);
    renderPDFPage();
  });

  $('#pdf-zoom-out').addEventListener('click', () => {
    state.pdf.scale = Math.max(0.5, state.pdf.scale - 0.25);
    renderPDFPage();
  });

  $('#pdf-fit-width').addEventListener('click', async () => {
    const page = await state.pdf.doc.getPage(state.pdf.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const wrapper = $('#pdf-canvas-wrapper');
    const targetWidth = wrapper.clientWidth - 40;
    state.pdf.scale = targetWidth / viewport.width;
    renderPDFPage();
  });

  $('#pdf-fit-page').addEventListener('click', async () => {
    const page = await state.pdf.doc.getPage(state.pdf.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const wrapper = $('#pdf-canvas-wrapper');
    const scaleX = (wrapper.clientWidth - 40) / viewport.width;
    const scaleY = (wrapper.clientHeight - 40) / viewport.height;
    state.pdf.scale = Math.min(scaleX, scaleY);
    renderPDFPage();
  });

  $('#pdf-fullscreen').addEventListener('click', () => {
    const left = $('#split-left');
    if (!document.fullscreenElement) {
      left.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  // Search
  $('#pdf-search-toggle').addEventListener('click', () => {
    const bar = $('#pdf-search-bar');
    bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
    if (bar.style.display === 'flex') {
      $('#pdf-search-input').focus();
    }
  });

  $('#pdf-search-close').addEventListener('click', () => {
    $('#pdf-search-bar').style.display = 'none';
  });

  // Keyboard nav for PDF
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft') {
      if (state.pdf.currentPage > 1) {
        state.pdf.currentPage--;
        renderPDFPage();
      }
    } else if (e.key === 'ArrowRight') {
      if (state.pdf.currentPage < state.pdf.totalPages) {
        state.pdf.currentPage++;
        renderPDFPage();
      }
    }
  });
}

// ---------- HIGHLIGHT ----------
function initHighlight() {
  const toggle = $('#pdf-highlight-toggle');
  const hCanvas = $('#pdf-highlight-canvas');
  
  // Tạo toolbar chọn màu
  const colorToolbar = document.createElement('div');
  colorToolbar.className = 'highlight-color-toolbar';
  colorToolbar.style.display = 'none';
  colorToolbar.innerHTML = `
    <button class="color-btn active" data-color="#FFFF00" title="Vàng" style="background: #FFFF00;"></button>
    <button class="color-btn" data-color="#00FF00" title="Xanh lá" style="background: #00FF00;"></button>
    <button class="color-btn" data-color="#00FFFF" title="Xanh da trời" style="background: #00FFFF;"></button>
    <button class="color-btn" data-color="#FF00FF" title="Hồng đậm" style="background: #FF00FF;"></button>
    <button class="color-btn" data-color="#FFA500" title="Cam" style="background: #FFA500;"></button>
    <button class="color-btn" data-color="#FF69B4" title="Hồng nhạt" style="background: #FF69B4;"></button>
    <button class="color-btn" data-color="#90EE90" title="Xanh nhạt" style="background: #90EE90;"></button>
  `;
  
  // Tạo nút Eraser
  const eraserBtn = document.createElement('button');
  eraserBtn.className = 'btn-icon';
  eraserBtn.id = 'pdf-highlight-eraser';
  eraserBtn.title = 'Tẩy highlight (click vào vùng tô)';
  eraserBtn.textContent = '🧹';
  eraserBtn.style.display = 'none';
  
  // Tạo nút Clear All
  const clearAllBtn = document.createElement('button');
  clearAllBtn.className = 'btn-icon';
  clearAllBtn.id = 'pdf-highlight-clear';
  clearAllBtn.title = 'Xóa tất cả highlight trang này';
  clearAllBtn.textContent = '🗑️';
  clearAllBtn.style.display = 'none';
  
  // Chèn vào toolbar
  toggle.parentNode.insertBefore(colorToolbar, toggle.nextSibling);
  toggle.parentNode.insertBefore(eraserBtn, colorToolbar.nextSibling);
  toggle.parentNode.insertBefore(clearAllBtn, eraserBtn.nextSibling);
  
  let eraserMode = false;
  let currentColor = '#FFFF00'; // Màu mặc định: vàng
  const highlightOpacity = 0.35; // Độ mờ màu highlight

  // Xử lý chọn màu
  colorToolbar.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      colorToolbar.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.dataset.color;
      state.pdf.highlightMode = true;
      eraserMode = false;
      hCanvas.classList.add('active');
      toggle.style.background = currentColor;
      toggle.style.color = '#000';
      eraserBtn.style.background = '';
      eraserBtn.style.color = '';
    });
  });

  // Toggle highlight mode
  toggle.addEventListener('click', () => {
    state.pdf.highlightMode = !state.pdf.highlightMode;
    if (state.pdf.highlightMode) {
      eraserMode = false;
      hCanvas.classList.add('active');
      toggle.style.background = currentColor;
      toggle.style.color = '#000';
      colorToolbar.style.display = 'flex';
      eraserBtn.style.display = 'inline-flex';
      clearAllBtn.style.display = 'inline-flex';
    } else {
      hCanvas.classList.remove('active');
      toggle.style.background = '';
      toggle.style.color = '';
      colorToolbar.style.display = 'none';
      eraserBtn.style.display = 'none';
      clearAllBtn.style.display = 'none';
      eraserBtn.style.background = '';
      eraserBtn.style.color = '';
    }
  });

  // Toggle eraser mode
  eraserBtn.addEventListener('click', () => {
    eraserMode = !eraserMode;
    state.pdf.highlightMode = false;
    toggle.style.background = '';
    toggle.style.color = '';
    colorToolbar.style.display = eraserMode ? 'flex' : 'none';
    hCanvas.classList.toggle('active', eraserMode);
    eraserBtn.style.background = eraserMode ? '#fc5c7d' : '';
    eraserBtn.style.color = eraserMode ? 'white' : '';
    clearAllBtn.style.background = '';
    clearAllBtn.style.color = '';
  });

  // Click để xóa highlight
  hCanvas.addEventListener('click', (e) => {
    if (!eraserMode) return;

    const rect = hCanvas.getBoundingClientRect();
    const scaleX = hCanvas.width / rect.width;
    const scaleY = hCanvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Chỉ xóa highlight của trang hiện tại
    const pageHighlightIndices = state.pdf.highlights
      .map((h, i) => ({ h, i }))
      .filter(x => x.h.page === state.pdf.currentPage);

    let foundIndex = -1;
    for (let j = pageHighlightIndices.length - 1; j >= 0; j--) {
      const item = pageHighlightIndices[j];
      if (clickX >= item.h.x && clickX <= item.h.x + item.h.width &&
          clickY >= item.h.y && clickY <= item.h.y + item.h.height) {
        foundIndex = item.i;
        break;
      }
    }

    if (foundIndex >= 0) {
      state.pdf.highlights.splice(foundIndex, 1);
      saveHighlights();
      redrawHighlights();
      showToast('Đã xóa highlight!', 'success');
    }
  });

  // Vẽ highlight
  let isDrawing = false;
  let startX, startY;

  hCanvas.addEventListener('mousedown', (e) => {
    if (!state.pdf.highlightMode || eraserMode) return;
    isDrawing = true;
    const rect = hCanvas.getBoundingClientRect();
    const scaleX = hCanvas.width / rect.width;
    const scaleY = hCanvas.height / rect.height;
    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;
    hCanvas.style.cursor = 'crosshair';
  });

  hCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !state.pdf.highlightMode) return;
    const rect = hCanvas.getBoundingClientRect();
    const scaleX = hCanvas.width / rect.width;
    const scaleY = hCanvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    // Vẽ preview
    redrawHighlights(); // Xóa canvas trước
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = hexToRgba(currentColor, highlightOpacity);
    ctx.fillRect(
      Math.min(startX, currentX),
      Math.min(startY, currentY),
      Math.abs(currentX - startX),
      Math.abs(currentY - startY)
    );
  });

  hCanvas.addEventListener('mouseup', (e) => {
    if (!isDrawing || !state.pdf.highlightMode) return;
    isDrawing = false;
    hCanvas.style.cursor = 'crosshair';

    const rect = hCanvas.getBoundingClientRect();
    const scaleX = hCanvas.width / rect.width;
    const scaleY = hCanvas.height / rect.height;
    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Chỉ lưu nếu đủ lớn
    if (width > 15 && height > 15) {
      const highlight = {
        page: state.pdf.currentPage, // Quan trọng: lưu số trang
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: width,
        height: height,
        color: currentColor // Lưu màu đã chọn
      };

      state.pdf.highlights.push(highlight);
      saveHighlights();
    }

    redrawHighlights();
  });

  hCanvas.addEventListener('mouseleave', () => {
    if (isDrawing) {
      isDrawing = false;
      redrawHighlights();
    }
  });
   

  // Clear All cho trang hiện tại
  clearAllBtn.addEventListener('click', () => {
    const pageHighlights = state.pdf.highlights.filter(h => h.page === state.pdf.currentPage);
    if (pageHighlights.length === 0) {
      showToast('Trang này không có highlight nào!', 'info');
      return;
    }
    if (confirm(`Xóa ${pageHighlights.length} highlight trên trang ${state.pdf.currentPage}?`)) {
      // Chỉ xóa highlight của trang hiện tại
      state.pdf.highlights = state.pdf.highlights.filter(h => h.page !== state.pdf.currentPage);
      saveHighlights();
      redrawHighlights();
      showToast(`Đã xóa ${pageHighlights.length} highlight!`, 'success');
    }
  });
  
  
}
// Vẽ lại tất cả highlight của trang hiện tại
function redrawHighlights() {
  const hCanvas = $('#pdf-highlight-canvas');
  if (!hCanvas) return;

  const ctx = hCanvas.getContext('2d');
  ctx.clearRect(0, 0, hCanvas.width, hCanvas.height);

  // CHỈ vẽ highlight của trang hiện tại
  const pageHighlights = state.pdf.highlights.filter(h => h.page === state.pdf.currentPage);

  const highlightOpacity = 0.35;

  pageHighlights.forEach(h => {
    // Lớp nền với màu đã chọn
    const color = h.color || '#FFFF00'; // Mặc định là vàng
    ctx.fillStyle = hexToRgba(color, highlightOpacity);
    ctx.fillRect(h.x, h.y, h.width, h.height);

    // Viền mỏng
    ctx.strokeStyle = hexToRgba(color, 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(h.x, h.y, h.width, h.height);
  });
}
// Lưu highlight vào localStorage
function saveHighlights() {
  localStorage.setItem(`highlights-${state.articleId}`, JSON.stringify(state.pdf.highlights));
}

// Load highlight từ localStorage
function loadHighlights() {
  try {
    state.pdf.highlights = JSON.parse(localStorage.getItem(`highlights-${state.articleId}`) || '[]');
  } catch {
    state.pdf.highlights = [];
  }
}
// ---------- QUESTIONS ----------
function renderQuestions() {
  const list = $('#questions-list');
  const questions = state.article.questions;

  if (!questions || questions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Không có câu hỏi nào.</p>';
    return;
  }

  list.innerHTML = questions.map((q, i) => createQuestionHTML(q, i)).join('');

  // Restore saved answers
  restoreAnswers();

  // Init interactions
  initQuestionInteractions();

  // Update progress
  updateProgress();
}

function createQuestionHTML(q, index) {
  const num = index + 1;
  let content = '';

  switch (q.type) {
    case 'mcq':
      content = createMCQ(q, index);
      break;
    case 'checkbox':
      content = createCheckbox(q, index);
      break;
    case 'fill':
      content = createFill(q, index);
      break;
    case 'matching':
      content = createMatching(q, index);
      break;
    case 'heading':
      content = createHeading(q, index);
      break;
    default:
      content = `<p>Unknown question type: ${q.type}</p>`;
  }

  return `
    <div class="question-card" data-index="${index}" data-type="${q.type}">
      <span class="question-number">Question ${num}</span>
      <div class="question-text">${escapeHtml(q.question)}</div>
      ${content}
      <div class="explanation" style="display:none;" data-index="${index}"></div>
    </div>
  `;
}

function createMCQ(q, index) {
  const choices = q.choices.map((choice, i) => `
    <div class="choice-item" data-index="${index}" data-choice="${i}">
      <input type="radio" name="q${index}" id="q${index}_${i}" value="${i}" />
      <label for="q${index}_${i}">${escapeHtml(choice)}</label>
    </div>
  `).join('');

  return `<div class="choice-list">${choices}</div>`;
}

function createCheckbox(q, index) {
  const choices = q.choices.map((choice, i) => `
    <div class="choice-item" data-index="${index}" data-choice="${i}">
      <input type="checkbox" name="q${index}" id="q${index}_${i}" value="${i}" />
      <label for="q${index}_${i}">${escapeHtml(choice)}</label>
    </div>
  `).join('');

  return `<div class="choice-list">${choices}</div>`;
}

function createFill(q, index) {
  return `
    <input type="text" class="fill-input" data-index="${index}"
           placeholder="Type your answer here..." autocomplete="off" />
  `;
}

function createMatching(q, index) {
  const leftItems = q.pairs.map((p, i) =>
    `<div class="matching-item" draggable="true" data-index="${index}" data-pair="${i}" data-side="left">
       ${escapeHtml(p.left)}
     </div>`
  ).join('');

  // Shuffle right side
  const rightIndices = q.pairs.map((_, i) => i);
  shuffleArray(rightIndices);

  const rightItems = rightIndices.map(i =>
    `<div class="matching-item" data-index="${index}" data-pair="${i}" data-side="right" data-drop-zone="true">
       ${escapeHtml(q.pairs[i].right)}
     </div>`
  ).join('');

  return `
    <div class="matching-container">
      <div class="matching-col">
        <h4>Items</h4>
        ${leftItems}
      </div>
      <div class="matching-col">
        <h4>Matches (drag here)</h4>
        ${rightItems}
      </div>
    </div>
  `;
}

function createHeading(q, index) {
  const items = q.paragraphs.map((para, i) => {
    const options = ['-- Select heading --', ...q.headings].map((h, hi) =>
      `<option value="${hi - 1}">${escapeHtml(h)}</option>`
    ).join('');

    return `
      <div class="heading-match-item" data-index="${index}" data-para="${i}">
        <div class="paragraph-text"><strong>Paragraph ${i + 1}:</strong> ${escapeHtml(para)}</div>
        <select class="heading-select" data-index="${index}" data-para="${i}">
          ${options}
        </select>
      </div>
    `;
  }).join('');

  return `<div class="heading-match-list">${items}</div>`;
}

// ---------- QUESTION INTERACTIONS ----------
function initQuestionInteractions() {
  // MCQ
  $$('.choice-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (state.checked) return;

      const card = item.closest('.question-card');
      const type = card.dataset.type;
      const index = item.dataset.index;
      const choice = item.dataset.choice;

      if (type === 'mcq') {
        // Deselect others
        card.querySelectorAll('.choice-item').forEach(ci => ci.classList.remove('selected'));
        card.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

        item.classList.add('selected');
        item.querySelector('input[type="radio"]').checked = true;
        state.userAnswers[index] = parseInt(choice);
      } else if (type === 'checkbox') {
        item.classList.toggle('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;

        // Save as array
        const selected = [];
        card.querySelectorAll('.choice-item.selected').forEach(ci => {
          selected.push(parseInt(ci.dataset.choice));
        });
        state.userAnswers[index] = selected;
      }

      saveUserAnswers();
      updateProgress();
    });
  });

  // Fill in the blank
  $$('.fill-input').forEach(input => {
    input.addEventListener('input', (e) => {
      if (state.checked) return;
      state.userAnswers[e.target.dataset.index] = e.target.value.trim();
      saveUserAnswers();
      updateProgress();
    });
  });

  // Heading selects
  $$('.heading-select').forEach(select => {
    select.addEventListener('change', (e) => {
      if (state.checked) return;
      const index = e.target.dataset.index;
      const para = e.target.dataset.para;

      if (!state.userAnswers[index]) state.userAnswers[index] = {};
      state.userAnswers[index][para] = parseInt(e.target.value);

      saveUserAnswers();
      updateProgress();
    });
  });

  // Matching - Drag & Drop
  initDragAndDrop();
}

function initDragAndDrop() {
  let draggedItem = null;

  $$('.matching-item[data-side="left"]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      if (state.checked) { e.preventDefault(); return; }
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
    });
  });

  $$('.matching-item[data-side="right"]').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.checked) return;
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      if (!draggedItem || state.checked) return;

      const index = draggedItem.dataset.index;
      const leftPair = draggedItem.dataset.pair;
      const rightPair = zone.dataset.pair;

      // Save the match
      if (!state.userAnswers[index]) state.userAnswers[index] = {};
      state.userAnswers[index][leftPair] = rightPair;

      // Visual feedback
      zone.textContent = draggedItem.textContent + ' → ' + zone.textContent;
      zone.classList.add('matched');
      draggedItem.style.opacity = '0.5';
      draggedItem.draggable = false;

      saveUserAnswers();
      updateProgress();
    });
  });
}

// ---------- SCOREBOARD ----------
function initScoreboard() {
  const nameInput = $('#student-name');
  nameInput.value = localStorage.getItem('studentName') || '';
  nameInput.addEventListener('input', (e) => {
    localStorage.setItem('studentName', e.target.value);
  });
}

function startTimer() {
  state.timer.start = Date.now() - (state.timer.elapsed * 1000);
  state.timer.interval = setInterval(updateTimer, 1000);
  updateTimer();
}

function updateTimer() {
  state.timer.elapsed = Math.floor((Date.now() - state.timer.start) / 1000);
  const mins = Math.floor(state.timer.elapsed / 60).toString().padStart(2, '0');
  const secs = (state.timer.elapsed % 60).toString().padStart(2, '0');
  $('#score-time').textContent = `${mins}:${secs}`;
}

function updateProgress() {
  const total = state.article.questions.length;
  const answered = Object.keys(state.userAnswers).length;
  const percent = Math.round((answered / total) * 100);

  $('#progress-bar').style.width = percent + '%';
  $('#progress-text').textContent = percent + '%';
}

// ---------- BUTTONS ----------
function initButtons() {
  $('#btn-back').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  $('#btn-check').addEventListener('click', checkAnswers);
  $('#btn-retry').addEventListener('click', () => showModal('modal-retry'));
  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-export').addEventListener('click', exportResults);

  $('#btn-bookmark').addEventListener('click', toggleBookmark);
  $('#btn-favorite').addEventListener('click', toggleFavorite);
  $('#btn-share').addEventListener('click', shareArticle);

  // Modal handlers
  $('#modal-retry-cancel').addEventListener('click', () => hideModal('modal-retry'));
  $('#modal-retry-confirm').addEventListener('click', () => {
    hideModal('modal-retry');
    retryQuiz();
  });
  $('#modal-result-close').addEventListener('click', () => hideModal('modal-result'));

  // Close modal on overlay click
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
}

// ---------- CHECK ANSWERS ----------
function checkAnswers() {
  if (state.checked) {
    showToast('Bạn đã kiểm tra rồi! Nhấn Retry để làm lại.', 'warning');
    return;
  }

  state.checked = true;
  let correct = 0;
  const total = state.article.questions.length;

  state.article.questions.forEach((q, i) => {
    const card = $(`.question-card[data-index="${i}"]`);
    const userAnswer = state.userAnswers[i];
    let isCorrect = false;

    switch (q.type) {
      case 'mcq':
        isCorrect = userAnswer === q.answer;
        highlightMCQ(card, q.answer, userAnswer);
        break;

      case 'checkbox':
        const userArr = Array.isArray(userAnswer) ? userAnswer.sort() : [];
        const correctArr = [...q.answer].sort();
        isCorrect = JSON.stringify(userArr) === JSON.stringify(correctArr);
        highlightCheckbox(card, q.answer, userAnswer || []);
        break;

      case 'fill':
        const userText = (userAnswer || '').toLowerCase().trim();
        const correctAnswers = q.answer.map(a => a.toLowerCase().trim());
        isCorrect = correctAnswers.includes(userText);
        highlightFill(card, isCorrect, q.answer[0]);
        break;

      case 'matching':
        isCorrect = checkMatching(q, userAnswer || {});
        highlightMatching(card, q, userAnswer || {});
        break;

      case 'heading':
        isCorrect = checkHeading(q, userAnswer || {});
        highlightHeading(card, q, userAnswer || {});
        break;
    }

    if (isCorrect) {
      correct++;
      card.classList.add('correct');
    } else {
      card.classList.add('incorrect');
    }

    // Show explanation
    const explanation = card.querySelector('.explanation');
    if (q.explanation) {
      explanation.innerHTML = `<strong>${isCorrect ? '✓ Correct!' : '✗ Incorrect.'}</strong> ${escapeHtml(q.explanation)}`;
      explanation.style.display = 'block';
    }
  });

  // Update score
  state.score.correct = correct;
  state.score.total = total;
  state.score.points = ((correct / total) * 10).toFixed(1);

  $('#score-correct').textContent = `${correct} / ${total}`;
  $('#score-points').textContent = `${state.score.points} / 10`;

  // Save to history
  saveToHistory();

  // Show result modal
  showResultModal();

  showToast(`Bạn đạt ${state.score.points}/10 điểm!`, correct === total ? 'success' : 'info');
}

function highlightMCQ(card, correctIdx, userIdx) {
  card.querySelectorAll('.choice-item').forEach(item => {
    const choice = parseInt(item.dataset.choice);
    if (choice === correctIdx) {
      item.classList.add('correct-answer');
    } else if (choice === userIdx && choice !== correctIdx) {
      item.classList.add('wrong-answer');
    }
  });
}

function highlightCheckbox(card, correctArr, userArr) {
  card.querySelectorAll('.choice-item').forEach(item => {
    const choice = parseInt(item.dataset.choice);
    if (correctArr.includes(choice)) {
      item.classList.add('correct-answer');
    }
    if (userArr.includes(choice) && !correctArr.includes(choice)) {
      item.classList.add('wrong-answer');
    }
  });
}

function highlightFill(card, isCorrect, correctAnswer) {
  const input = card.querySelector('.fill-input');
  input.classList.add(isCorrect ? 'correct' : 'incorrect');
  input.readOnly = true;

  if (!isCorrect) {
    const hint = document.createElement('div');
    hint.className = 'explanation';
    hint.style.display = 'block';
    hint.style.marginTop = '8px';
    hint.innerHTML = `<strong>Correct answer:</strong> ${escapeHtml(correctAnswer)}`;
    input.parentNode.insertBefore(hint, input.nextSibling);
  }
}

function checkMatching(q, userAnswers) {
  return q.pairs.every((pair, i) => userAnswers[i] == i);
}

function highlightMatching(card, q, userAnswers) {
  card.querySelectorAll('.matching-item[data-side="right"]').forEach(zone => {
    const rightPair = parseInt(zone.dataset.pair);
    // Check if any left item was matched to this right item
    let matchedLeft = null;
    for (const [leftPair, rPair] of Object.entries(userAnswers)) {
      if (parseInt(rPair) === rightPair) {
        matchedLeft = parseInt(leftPair);
        break;
      }
    }

    if (matchedLeft !== null) {
      if (matchedLeft === rightPair) {
        zone.classList.add('matched');
      } else {
        zone.classList.add('wrong-match');
      }
    }
  });
}

function checkHeading(q, userAnswers) {
  return q.paragraphs.every((_, i) => userAnswers[i] === i);
}

function highlightHeading(card, q, userAnswers) {
  card.querySelectorAll('.heading-match-item').forEach(item => {
    const para = parseInt(item.dataset.para);
    const select = item.querySelector('.heading-select');
    const userChoice = userAnswers[para];

    if (userChoice === para) {
      item.style.borderColor = '#48bb78';
      item.style.background = 'rgba(72, 187, 120, 0.08)';
    } else {
      item.style.borderColor = '#fc5c7d';
      item.style.background = 'rgba(252, 92, 125, 0.08)';
    }
    select.disabled = true;
  });
}

// ---------- RESULT MODAL ----------
function showResultModal() {
  const percent = Math.round((state.score.correct / state.score.total) * 100);
  const mins = Math.floor(state.timer.elapsed / 60);
  const secs = state.timer.elapsed % 60;

  const history = getHistory();
  const historyRows = history.slice(0, 5).map(h => `
    <tr>
      <td>${new Date(h.date).toLocaleString('vi-VN')}</td>
      <td>${h.correct}/${h.total}</td>
      <td>${h.points}/10</td>
      <td>${Math.floor(h.time / 60)}m ${h.time % 60}s</td>
    </tr>
  `).join('');

  $('#result-content').innerHTML = `
    <div class="result-summary">
      <div class="result-stat">
        <div class="value">${state.score.correct}/${state.score.total}</div>
        <div class="label">Câu đúng</div>
      </div>
      <div class="result-stat">
        <div class="value">${state.score.points}</div>
        <div class="label">Điểm /10</div>
      </div>
      <div class="result-stat">
        <div class="value">${percent}%</div>
        <div class="label">Tỉ lệ đúng</div>
      </div>
      <div class="result-stat">
        <div class="value">${mins}:${secs.toString().padStart(2, '0')}</div>
        <div class="label">Thời gian</div>
      </div>
    </div>

    ${history.length > 0 ? `
      <h4 style="margin-top:20px;margin-bottom:10px;">📊 Lịch sử điểm</h4>
      <div class="result-history">
        <table>
          <thead>
            <tr><th>Thời gian</th><th>Đúng</th><th>Điểm</th><th>Thời lượng</th></tr>
          </thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>
    ` : ''}
  `;

  showModal('modal-result');
}

// ---------- RETRY ----------
function retryQuiz() {
  state.checked = false;
  state.userAnswers = {};
  state.score = { correct: 0, total: 0, points: 0 };
  state.timer.elapsed = 0;

  // Clear UI
  $$('.question-card').forEach(card => {
    card.classList.remove('correct', 'incorrect');
    card.querySelectorAll('.choice-item').forEach(ci => {
      ci.classList.remove('selected', 'correct-answer', 'wrong-answer');
    });
    card.querySelectorAll('input').forEach(inp => {
      inp.checked = false;
      if (inp.type === 'text') {
        inp.value = '';
        inp.classList.remove('correct', 'incorrect');
        inp.readOnly = false;
      }
    });
    card.querySelectorAll('.explanation').forEach(e => e.style.display = 'none');
    card.querySelectorAll('.heading-select').forEach(s => s.disabled = false);
    card.querySelectorAll('.heading-match-item').forEach(item => {
      item.style.borderColor = '';
      item.style.background = '';
    });
    card.querySelectorAll('.matching-item').forEach(item => {
      item.classList.remove('matched', 'wrong-match');
      item.style.opacity = '';
      item.draggable = true;
    });
  });

  // Reset scoreboard
  $('#score-correct').textContent = `0 / ${state.article.questions.length}`;
  $('#score-points').textContent = '0.0 / 10';
  updateProgress();

  // Restart timer
  clearInterval(state.timer.interval);
  startTimer();

  // Clear saved answers
  localStorage.removeItem(`answers-${state.articleId}`);

  showToast('Đã làm lại từ đầu!', 'success');
}

// ---------- BOOKMARK & FAVORITE ----------
function toggleBookmark() {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  const idx = bookmarks.indexOf(state.articleId);

  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    showToast('Đã bỏ bookmark', 'info');
  } else {
    bookmarks.push(state.articleId);
    showToast('Đã thêm bookmark!', 'success');
  }

  localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  updateBookmarkUI();
}

function updateBookmarkUI() {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  const isBookmarked = bookmarks.includes(state.articleId);
  $('#btn-bookmark').textContent = isBookmarked ? '📑' : '🔖';
}

function toggleFavorite() {
  const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  const idx = favorites.indexOf(state.articleId);

  if (idx >= 0) {
    favorites.splice(idx, 1);
    showToast('Đã bỏ yêu thích', 'info');
  } else {
    favorites.push(state.articleId);
    showToast('Đã thêm vào yêu thích! ❤️', 'success');
  }

  localStorage.setItem('favorites', JSON.stringify(favorites));
  updateFavoriteUI();
}

function updateFavoriteUI() {
  const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  const isFav = favorites.includes(state.articleId);
  $('#btn-favorite').textContent = isFav ? '❤️' : '🤍';
}

function shareArticle() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({
      title: state.article.title,
      text: `Practice reading: ${state.article.title}`,
      url: url
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Đã copy link!', 'success');
    });
  }
}

// ---------- SAVE/LOAD STATE ----------
function saveUserAnswers() {
  localStorage.setItem(`answers-${state.articleId}`, JSON.stringify({
    userAnswers: state.userAnswers,
    elapsed: state.timer.elapsed
  }));
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(`answers-${state.articleId}`));
    if (saved) {
      state.userAnswers = saved.userAnswers || {};
      state.timer.elapsed = saved.elapsed || 0;
    }
    loadHighlights();
  } catch {
    state.userAnswers = {};
  }
}

function restoreAnswers() {
  Object.entries(state.userAnswers).forEach(([index, answer]) => {
    const q = state.article.questions[index];
    const card = $(`.question-card[data-index="${index}"]`);

    if (!card || !q) return;

    switch (q.type) {
      case 'mcq':
        if (typeof answer === 'number') {
          const item = card.querySelector(`.choice-item[data-choice="${answer}"]`);
          if (item) {
            item.classList.add('selected');
            item.querySelector('input').checked = true;
          }
        }
        break;

      case 'checkbox':
        if (Array.isArray(answer)) {
          answer.forEach(choice => {
            const item = card.querySelector(`.choice-item[data-choice="${choice}"]`);
            if (item) {
              item.classList.add('selected');
              item.querySelector('input').checked = true;
            }
          });
        }
        break;

      case 'fill':
        const input = card.querySelector('.fill-input');
        if (input && typeof answer === 'string') {
          input.value = answer;
        }
        break;

      case 'heading':
        if (typeof answer === 'object') {
          Object.entries(answer).forEach(([para, val]) => {
            const select = card.querySelector(`.heading-select[data-para="${para}"]`);
            if (select) select.value = val;
          });
        }
        break;
    }
  });
}

// ---------- HISTORY ----------
function saveToHistory() {
  const history = getHistory();
  history.unshift({
    date: Date.now(),
    correct: state.score.correct,
    total: state.score.total,
    points: parseFloat(state.score.points),
    time: state.timer.elapsed
  });
  localStorage.setItem(`history-${state.articleId}`, JSON.stringify(history.slice(0, 20)));
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(`history-${state.articleId}`) || '[]');
  } catch {
    return [];
  }
}

// ---------- EXPORT ----------
function exportResults() {
  if (!state.checked) {
    showToast('Vui lòng kiểm tra đáp án trước!', 'warning');
    return;
  }

  const name = $('#student-name').value || 'Student';
  const mins = Math.floor(state.timer.elapsed / 60);
  const secs = state.timer.elapsed % 60;

  const content = `
    <html>
    <head><title>Result - ${state.article.title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; }
      h1 { color: #667eea; }
      .stat { display: inline-block; margin: 10px 20px; padding: 15px; background: #f0f0ff; border-radius: 8px; }
      .stat .value { font-size: 2em; font-weight: bold; color: #667eea; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
      .correct { color: #48bb78; font-weight: bold; }
      .incorrect { color: #fc5c7d; font-weight: bold; }
    </style></head>
    <body>
      <h1>📚 ${state.article.title}</h1>
      <p><strong>Student:</strong> ${name}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString('vi-VN')}</p>

      <div>
        <div class="stat"><div class="value">${state.score.correct}/${state.score.total}</div>Correct</div>
        <div class="stat"><div class="value">${state.score.points}/10</div>Score</div>
        <div class="stat"><div class="value">${mins}:${secs.toString().padStart(2, '0')}</div>Time</div>
      </div>

      <h2>Questions</h2>
      <table>
        <tr><th>#</th><th>Question</th><th>Your Answer</th><th>Correct</th><th>Result</th></tr>
        ${state.article.questions.map((q, i) => {
          const user = state.userAnswers[i];
          let isCorrect = false;
          let userText = '', correctText = '';

          if (q.type === 'mcq') {
            userText = q.choices[user] || '-';
            correctText = q.choices[q.answer];
            isCorrect = user === q.answer;
          } else if (q.type === 'fill') {
            userText = user || '-';
            correctText = q.answer[0];
            isCorrect = q.answer.map(a => a.toLowerCase()).includes((user || '').toLowerCase());
          }

          return `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(q.question)}</td>
            <td>${escapeHtml(userText)}</td>
            <td>${escapeHtml(correctText)}</td>
            <td class="${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? '✓' : '✗'}</td>
          </tr>`;
        }).join('')}
      </table>
    </body></html>
  `;

  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `result-${state.articleId}.html`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Đã xuất kết quả!', 'success');
}

// ---------- KEYBOARD ----------
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
      $$('.modal-overlay').forEach(m => m.style.display = 'none');
    }
  });
}

// ---------- MODALS ----------
function showModal(id) {
  $(`#${id}`).style.display = 'flex';
}

function hideModal(id) {
  $(`#${id}`).style.display = 'none';
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

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// Chuyển hex color sang rgba
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
