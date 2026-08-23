/**
 * Oracle Certification Exam Simulator - Application Logic
 * Full-Stack Edition with Auth, Question Mastery, & Admin Analytics
 */

(function () {
  // Application State
  const state = {
    user: null,           // { id, username, role }
    token: localStorage.getItem('oracle_cert_token') || null,
    userMastery: {
      confidentQuestions: new Set(), // question IDs answered correctly >= 2 times
      learningQuestions: new Set(),  // answered correctly 1 time
      totalAttempts: 0,
      bestScore: 0,
      recentAttempts: []
    },
    rawQuestions: [],
    questions: [],
    currentIndex: 0,
    userAnswers: {},     // { [qId]: Set of optionIds }
    flagged: new Set(),  // Set of qIds
    checked: new Set(),  // Set of qIds where answer was checked (Study mode)
    mode: 'exam',        // 'exam' | 'study'
    isShuffled: false,   // Default to sequential order matching Excel
    fontScale: 1.0,
    timerSeconds: 90 * 60, // 90 minutes
    timerInterval: null,
    examFinished: false,
    startTime: Date.now()
  };

  // DOM Elements
  const els = {
    // Auth Elements
    authGate: document.getElementById('auth-gate'),
    app: document.getElementById('app'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    formLogin: document.getElementById('form-login'),
    formRegister: document.getElementById('form-register'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error'),
    regUsername: document.getElementById('reg-username'),
    regPassword: document.getElementById('reg-password'),
    regSecret: document.getElementById('reg-secret'),
    regError: document.getElementById('reg-error'),

    // User Profile in Header
    userDisplayName: document.getElementById('user-display-name'),
    userRoleBadge: document.getElementById('user-role-badge'),
    btnUserProfile: document.getElementById('btn-user-profile'),
    btnAdminPanel: document.getElementById('btn-admin-panel'),
    btnLogout: document.getElementById('btn-logout'),
    userConfidentCount: document.getElementById('user-confident-count'),
    userMasteryIndicator: document.getElementById('user-mastery-indicator'),

    // Header & Toolbar
    currentQNum: document.getElementById('current-q-num'),
    totalQNum: document.getElementById('total-q-num'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    timerDisplay: document.getElementById('timer-display'),
    timerContainer: document.getElementById('timer-container'),
    markReviewBtn: document.getElementById('mark-review-btn'),
    flagText: document.getElementById('flag-text'),
    modeExamBtn: document.getElementById('mode-exam-btn'),
    modeStudyBtn: document.getElementById('mode-study-btn'),
    shuffleToggleBtn: document.getElementById('shuffle-toggle-btn'),
    fontDecrease: document.getElementById('font-decrease'),
    fontIncrease: document.getElementById('font-increase'),
    
    // Main question area
    examMainArea: document.getElementById('exam-main-area'),
    qTypeBadge: document.getElementById('q-type-badge'),
    qMasteryBadge: document.getElementById('q-mastery-badge'),
    qStatusBadge: document.getElementById('q-status-badge'),
    questionText: document.getElementById('question-text'),
    exhibitWrapper: document.getElementById('exhibit-wrapper'),
    exhibitContent: document.getElementById('exhibit-content'),
    copyExhibitBtn: document.getElementById('copy-exhibit-btn'),
    optionsInstructionText: document.getElementById('options-instruction-text'),
    optionsList: document.getElementById('options-list'),
    explanationPanel: document.getElementById('explanation-panel'),
    explResultIcon: document.getElementById('expl-result-icon'),
    explResultTitle: document.getElementById('expl-result-title'),
    explBody: document.getElementById('expl-body'),
    
    // Footer buttons
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnFinish: document.getElementById('btn-finish'),
    btnCheckAnswer: document.getElementById('btn-check-answer'),
    btnGridModal: document.getElementById('btn-grid-modal'),
    gridViewBtn: document.getElementById('grid-view-btn'),
    btnReset: document.getElementById('btn-reset'),

    // Review Modal
    reviewModal: document.getElementById('review-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    modalResumeBtn: document.getElementById('modal-resume-btn'),
    modalSubmitBtn: document.getElementById('modal-submit-btn'),
    questionsGrid: document.getElementById('questions-grid'),
    statAnswered: document.getElementById('stat-answered'),
    statUnanswered: document.getElementById('stat-unanswered'),
    statFlagged: document.getElementById('stat-flagged'),
    
    // Results Modal
    resultsModal: document.getElementById('results-modal'),
    scorePercentage: document.getElementById('score-percentage'),
    scoreStatus: document.getElementById('score-status'),
    scoreCircle: document.getElementById('score-circle'),
    resScore: document.getElementById('res-score'),
    resTimeTaken: document.getElementById('res-time-taken'),
    resFinalBadge: document.getElementById('res-final-badge'),
    btnReviewAnswers: document.getElementById('btn-review-answers'),
    btnRetakeExam: document.getElementById('btn-retake-exam'),

    // Profile Modal
    profileModal: document.getElementById('profile-modal'),
    closeProfileBtn: document.getElementById('close-profile-btn'),
    profAttempts: document.getElementById('prof-attempts'),
    profBestScore: document.getElementById('prof-best-score'),
    profConfidentCount: document.getElementById('prof-confident-count'),
    profMasteryPct: document.getElementById('prof-mastery-pct'),
    attemptsHistoryList: document.getElementById('attempts-history-list'),

    // Admin Modal
    adminModal: document.getElementById('admin-modal'),
    closeAdminBtn: document.getElementById('close-admin-btn'),
    admTotalUsers: document.getElementById('adm-total-users'),
    admTotalExams: document.getElementById('adm-total-exams'),
    admAvgScore: document.getElementById('adm-avg-score'),
    admPassedExams: document.getElementById('adm-passed-exams'),
    adminUsersTableBody: document.getElementById('admin-users-table-body')
  };

  // Helper: Shuffle Array (Fisher-Yates)
  function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Helper: Render Question Text with Embedded Terminal Codeblocks
  function renderFormattedMarkdown(container, markdownText) {
    container.innerHTML = '';
    if (!markdownText) return;

    const parts = markdownText.split(/```/);
    parts.forEach((part, idx) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      if (idx % 2 === 1) {
        // Embedded Code block
        const wrapper = document.createElement('div');
        wrapper.className = 'exhibit-wrapper';
        wrapper.style.margin = '0.75rem 0';

        const header = document.createElement('div');
        header.className = 'exhibit-header';
        
        const title = document.createElement('span');
        title.className = 'exhibit-title';
        title.textContent = 'Command / Terminal Output';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-copy';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(trimmed).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
          });
        };

        header.appendChild(title);
        header.appendChild(copyBtn);

        const pre = document.createElement('pre');
        pre.className = 'exhibit-content';
        pre.textContent = trimmed;

        wrapper.appendChild(header);
        wrapper.appendChild(pre);
        container.appendChild(wrapper);
      } else {
        // Normal text block
        const paragraphs = part.split(/\n\n+/);
        paragraphs.forEach(pText => {
          const pTrimmed = pText.trim();
          if (pTrimmed) {
            const p = document.createElement('div');
            p.className = 'q-prompt-paragraph';
            p.style.whiteSpace = 'pre-line';
            p.style.marginBottom = '0.5rem';
            p.textContent = pTrimmed;
            container.appendChild(p);
          }
        });
      }
    });
  }

  // ==========================================================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // ==========================================================================
  async function initAuth() {
    if (state.token) {
      try {
        const res = await fetch('/api/auth?action=me', {
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            loginUserSuccess(data.user, state.token);
            return;
          }
        }
      } catch (err) {
        // If running locally without backend, check saved local user
        const savedUser = localStorage.getItem('oracle_cert_user');
        if (savedUser) {
          loginUserSuccess(JSON.parse(savedUser), state.token);
          return;
        }
      }
    }
    showAuthGate();
  }

  function showAuthGate() {
    els.authGate.classList.remove('hidden');
    els.app.classList.add('hidden');
  }

  function loginUserSuccess(user, token) {
    const uname = (user.username || '').toLowerCase();
    if (uname === 'ammaru' || uname === 'ammar') {
      user.role = 'admin';
    }
    state.user = user;
    state.token = token;
    localStorage.setItem('oracle_cert_token', token);
    localStorage.setItem('oracle_cert_user', JSON.stringify(user));

    // Update Header UI
    els.userDisplayName.textContent = user.username;
    els.userRoleBadge.textContent = (user.role || 'user').toUpperCase();
    els.userRoleBadge.className = `role-badge ${user.role || 'user'}`;

    if (user.role === 'admin') {
      els.btnAdminPanel.classList.remove('hidden');
    } else {
      els.btnAdminPanel.classList.add('hidden');
    }

    els.authGate.classList.add('hidden');
    els.app.classList.remove('hidden');

    loadUserProgress();
    startNewSession();
    startTimer();
  }

  function logoutUser() {
    localStorage.removeItem('oracle_cert_token');
    localStorage.removeItem('oracle_cert_user');
    state.user = null;
    state.token = null;
    if (state.timerInterval) clearInterval(state.timerInterval);
    showAuthGate();
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    els.loginError.classList.add('hidden');
    const username = els.loginUsername.value.trim();
    const password = els.loginPassword.value.trim();

    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      loginUserSuccess(data.user, data.token);
    } catch (err) {
      // Fallback for local testing without server
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        const localRole = username.toLowerCase() === 'ammar' ? 'admin' : 'user';
        const fakeToken = btoa(JSON.stringify({ id: 'usr_local_' + username, username, role: localRole, exp: Date.now() + 86400000 }));
        loginUserSuccess({ id: 'usr_local_' + username, username, role: localRole }, fakeToken);
      } else {
        els.loginError.textContent = err.message;
        els.loginError.classList.remove('hidden');
      }
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    els.regError.classList.add('hidden');
    const username = els.regUsername.value.trim();
    const password = els.regPassword.value.trim();
    const secret = els.regSecret.value.trim();

    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, secret })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      loginUserSuccess(data.user, data.token);
    } catch (err) {
      // Fallback for local testing
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        const cleanSecret = secret.toLowerCase();
        if (cleanSecret !== 'candidate2026' && cleanSecret !== 'admin2026') {
          els.regError.textContent = 'Invalid invitation secret passcode. Access is restricted.';
          els.regError.classList.remove('hidden');
          return;
        }
        const role = cleanSecret === 'admin2026' ? 'admin' : 'user';
        const fakeToken = btoa(JSON.stringify({ id: 'usr_local_' + username, username, role, exp: Date.now() + 86400000 }));
        loginUserSuccess({ id: 'usr_local_' + username, username, role }, fakeToken);
      } else {
        els.regError.textContent = err.message;
        els.regError.classList.remove('hidden');
      }
    }
  }

  // ==========================================================================
  // PROGRESS & MASTERY SYNC
  // ==========================================================================
  async function loadUserProgress() {
    if (!state.token) return;

    try {
      const res = await fetch('/api/progress', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        state.userMastery.confidentQuestions = new Set(data.confident_question_ids || []);
        state.userMastery.learningQuestions = new Set(data.learning_question_ids || []);
        state.userMastery.totalAttempts = data.stats.total_attempts || 0;
        state.userMastery.bestScore = data.stats.best_score || 0;
        state.userMastery.recentAttempts = data.recent_attempts || [];
        updateMasteryUI();
      }
    } catch (err) {
      // Offline / LocalStorage fallback
      const localMastery = JSON.parse(localStorage.getItem(`mastery_${state.user?.username}`) || '{}');
      const confident = Object.keys(localMastery).filter(k => localMastery[k] >= 2).map(Number);
      state.userMastery.confidentQuestions = new Set(confident);
      updateMasteryUI();
    }
  }

  function updateMasteryUI() {
    const confidentCount = state.userMastery.confidentQuestions.size;
    els.userConfidentCount.textContent = confidentCount;
  }

  async function recordExamAttempt(score, total, percentage, isPass, timeSeconds) {
    const questionResults = state.questions.map(q => {
      const userSelected = state.userAnswers[q.id] || new Set();
      const correctIds = new Set(q.correct_option_ids);
      const isCorrect = userSelected.size === correctIds.size && [...userSelected].every(id => correctIds.has(id));
      return {
        question_id: q.id,
        is_correct: isCorrect
      };
    });

    // Send to Cloudflare Pages API
    if (state.token) {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({
            score,
            total_questions: total,
            percentage,
            passed: isPass,
            time_taken_seconds: timeSeconds,
            mode: state.mode,
            question_results: questionResults
          })
        });
        loadUserProgress();
      } catch (err) {
        console.warn('Could not sync progress with cloud:', err);
      }
    }

    // LocalStorage fallback update
    if (state.user) {
      const storageKey = `mastery_${state.user.username}`;
      const localMastery = JSON.parse(localStorage.getItem(storageKey) || '{}');
      questionResults.forEach(r => {
        if (r.is_correct) {
          localMastery[r.question_id] = (localMastery[r.question_id] || 0) + 1;
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(localMastery));
      const confident = Object.keys(localMastery).filter(k => localMastery[k] >= 2).map(Number);
      state.userMastery.confidentQuestions = new Set(confident);
      updateMasteryUI();
    }
  }

  // ==========================================================================
  // EXAM ENGINE LOGIC
  // ==========================================================================
  async function init() {
    if (window.QUIZ_DATA && Array.isArray(window.QUIZ_DATA)) {
      state.rawQuestions = window.QUIZ_DATA;
    } else {
      try {
        const res = await fetch('quiz_data.json');
        state.rawQuestions = await res.json();
      } catch (err) {
        console.error('Failed to load quiz data:', err);
      }
    }

    bindEvents();
    initAuth();
  }

  function startNewSession() {
    state.currentIndex = 0;
    state.userAnswers = {};
    state.flagged.clear();
    state.checked.clear();
    state.examFinished = false;
    state.timerSeconds = 90 * 60;
    state.startTime = Date.now();

    if (state.isShuffled) {
      state.questions = shuffleArray(state.rawQuestions).map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }));
    } else {
      state.questions = state.rawQuestions.map(q => ({
        ...q,
        options: [...q.options]
      }));
    }

    els.totalQNum.textContent = state.questions.length;
    renderCurrentQuestion();
    updateReviewGrid();
  }

  function renderCurrentQuestion() {
    const q = state.questions[state.currentIndex];
    if (!q) return;

    els.currentQNum.textContent = state.currentIndex + 1;
    const progressPct = ((state.currentIndex + 1) / state.questions.length) * 100;
    els.progressBarFill.style.width = `${progressPct}%`;

    els.btnPrev.disabled = state.currentIndex === 0;
    els.btnNext.disabled = state.currentIndex === state.questions.length - 1;

    const isFlagged = state.flagged.has(q.id);
    els.markReviewBtn.classList.toggle('flagged', isFlagged);
    els.flagText.textContent = isFlagged ? 'Marked for Review' : 'Mark for Review';

    const isMulti = (q.required_selections > 1) || q.type === 'multi_choice' || q.type === 'multiple_choice';
    if (isMulti) {
      els.qTypeBadge.className = 'badge badge-multi';
      els.qTypeBadge.textContent = `Select ${q.required_selections} answers`;
      els.optionsInstructionText.textContent = `Choose ${q.required_selections} options:`;
    } else {
      els.qTypeBadge.className = 'badge badge-single';
      els.qTypeBadge.textContent = 'Select 1 answer';
      els.optionsInstructionText.textContent = 'Choose 1 option:';
    }

    // Confident mastery badge on this question
    const isConfident = state.userMastery.confidentQuestions.has(q.id);
    if (isConfident) {
      els.qMasteryBadge.classList.remove('hidden');
    } else {
      els.qMasteryBadge.classList.add('hidden');
    }

    const currentSelections = state.userAnswers[q.id] || new Set();
    const isAnswered = currentSelections.size > 0;
    els.qStatusBadge.textContent = isAnswered ? 'Answered' : 'Unanswered';
    els.qStatusBadge.classList.toggle('answered', isAnswered);

    // Render question prompt with support for embedded terminal codeblocks
    renderFormattedMarkdown(els.questionText, q.question);

    if (q.exhibit && q.exhibit.trim()) {
      els.exhibitWrapper.classList.remove('hidden');
      els.exhibitContent.textContent = q.exhibit;
    } else {
      els.exhibitWrapper.classList.add('hidden');
    }

    els.optionsList.innerHTML = '';
    const isAdminStudy = Boolean(state.user && state.user.role === 'admin' && state.mode === 'study');
    const isChecked = state.checked.has(q.id) || state.examFinished || isAdminStudy;

    q.options.forEach((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const isSelected = currentSelections.has(opt.id);

      const label = document.createElement('label');
      label.className = `option-item ${isSelected ? 'selected' : ''}`;
      
      if (isChecked) {
        if (opt.is_correct) {
          label.classList.add('show-correct');
        } else if (isSelected && !opt.is_correct) {
          label.classList.add('show-incorrect');
        }
      }

      const input = document.createElement('input');
      input.type = isMulti ? 'checkbox' : 'radio';
      input.name = `opt_q_${q.id}`;
      input.value = opt.id;
      input.className = 'option-input';
      input.checked = isSelected || (isAdminStudy && opt.is_correct);
      input.disabled = isChecked && !isAdminStudy && state.mode === 'study' && state.checked.has(q.id);

      input.addEventListener('change', () => handleOptionSelection(q, opt.id, isMulti));

      const letterBadge = document.createElement('span');
      letterBadge.className = 'opt-letter-badge';
      letterBadge.textContent = `${letter}.`;

      const textSpan = document.createElement('span');
      textSpan.className = 'opt-text';
      textSpan.textContent = opt.text;

      label.appendChild(input);
      label.appendChild(letterBadge);
      label.appendChild(textSpan);
      els.optionsList.appendChild(label);
    });

    if (state.mode === 'study') {
      if (isAdminStudy) {
        els.btnCheckAnswer.classList.add('hidden');
        showExplanation(q);
      } else {
        els.btnCheckAnswer.classList.remove('hidden');
        if (isChecked) {
          showExplanation(q);
        } else {
          els.explanationPanel.classList.add('hidden');
        }
      }
    } else {
      els.btnCheckAnswer.classList.add('hidden');
      if (state.examFinished) {
        showExplanation(q);
      } else {
        els.explanationPanel.classList.add('hidden');
      }
    }
  }

  function handleOptionSelection(q, optId, isMulti) {
    if (!state.userAnswers[q.id]) {
      state.userAnswers[q.id] = new Set();
    }
    const selections = state.userAnswers[q.id];

    if (isMulti) {
      if (selections.has(optId)) {
        selections.delete(optId);
      } else {
        if (selections.size >= q.required_selections) {
          const firstItem = selections.values().next().value;
          selections.delete(firstItem);
        }
        selections.add(optId);
      }
    } else {
      selections.clear();
      selections.add(optId);
    }

    renderCurrentQuestion();
    updateReviewGrid();
  }

  function showExplanation(q) {
    const isAdminStudy = Boolean(state.user && state.user.role === 'admin' && state.mode === 'study');
    const userSelected = state.userAnswers[q.id] || new Set();
    const correctIds = new Set(q.correct_option_ids);
    const isCorrect = isAdminStudy || (userSelected.size === correctIds.size && [...userSelected].every(id => correctIds.has(id)));

    els.explanationPanel.classList.remove('hidden');
    els.explanationPanel.className = `explanation-panel ${isCorrect ? 'correct' : 'incorrect'}`;
    
    els.explResultIcon.textContent = isCorrect ? '✓' : '✗';
    els.explResultTitle.textContent = isAdminStudy
      ? 'Verified Answer & Explanation (Admin Auto-Review):'
      : (isCorrect ? 'Correct! Explanation:' : 'Incorrect. Solution & Explanation:');
    
    els.explBody.innerHTML = `
      <p style="margin-bottom: 6px;"><strong>Key Explanation:</strong> ${q.explanation}</p>
    `;
  }

  function checkCurrentAnswer() {
    const q = state.questions[state.currentIndex];
    state.checked.add(q.id);
    renderCurrentQuestion();
  }

  function toggleFlag() {
    const q = state.questions[state.currentIndex];
    if (state.flagged.has(q.id)) {
      state.flagged.delete(q.id);
    } else {
      state.flagged.add(q.id);
    }
    renderCurrentQuestion();
    updateReviewGrid();
  }

  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      if (state.examFinished) return;
      if (state.timerSeconds > 0) {
        state.timerSeconds--;
        updateTimerDisplay();
      } else {
        clearInterval(state.timerInterval);
        alert('Time is up! Submitting your exam now.');
        finishExam();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const hrs = Math.floor(state.timerSeconds / 3600);
    const mins = Math.floor((state.timerSeconds % 3600) / 60);
    const secs = state.timerSeconds % 60;
    
    const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    els.timerDisplay.textContent = formatted;

    if (state.timerSeconds <= 300) {
      els.timerContainer.classList.add('warning');
    } else {
      els.timerContainer.classList.remove('warning');
    }
  }

  function updateReviewGrid() {
    els.questionsGrid.innerHTML = '';
    let answeredCount = 0;
    let flaggedCount = 0;

    state.questions.forEach((q, idx) => {
      const isAnswered = (state.userAnswers[q.id] && state.userAnswers[q.id].size > 0);
      const isFlagged = state.flagged.has(q.id);
      const isCurrent = idx === state.currentIndex;

      if (isAnswered) answeredCount++;
      if (isFlagged) flaggedCount++;

      const btn = document.createElement('button');
      btn.className = `grid-q-btn ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''} ${isCurrent ? 'current' : ''}`;
      btn.textContent = idx + 1;
      btn.addEventListener('click', () => {
        state.currentIndex = idx;
        renderCurrentQuestion();
        closeModal();
      });
      els.questionsGrid.appendChild(btn);
    });

    els.statAnswered.textContent = answeredCount;
    els.statUnanswered.textContent = state.questions.length - answeredCount;
    els.statFlagged.textContent = flaggedCount;
  }

  function finishExam() {
    state.examFinished = true;
    closeModal();

    let correctCount = 0;
    state.questions.forEach(q => {
      const userSelected = state.userAnswers[q.id] || new Set();
      const correctIds = new Set(q.correct_option_ids);
      if (userSelected.size === correctIds.size && [...userSelected].every(id => correctIds.has(id))) {
        correctCount++;
      }
    });

    const total = state.questions.length;
    const scorePct = Math.round((correctCount / total) * 100);
    const isPass = scorePct >= 60;

    const elapsedSecs = Math.round((Date.now() - state.startTime) / 1000);
    const elMins = Math.floor(elapsedSecs / 60);
    const elSecs = elapsedSecs % 60;

    // Record Attempt in DB
    recordExamAttempt(correctCount, total, scorePct, isPass, elapsedSecs);

    // Populate Results Modal
    els.scorePercentage.textContent = `${scorePct}%`;
    els.scoreStatus.textContent = isPass ? 'PASSED' : 'FAILED';
    els.scoreCircle.className = `score-circle ${isPass ? 'pass' : 'fail'}`;

    els.resScore.textContent = `${correctCount} / ${total}`;
    els.resTimeTaken.textContent = `${elMins}m ${elSecs}s`;
    els.resFinalBadge.textContent = isPass ? 'PASS' : 'FAIL';
    els.resFinalBadge.className = `sc-badge ${isPass ? 'pass' : 'fail'}`;

    els.resultsModal.classList.remove('hidden');
  }

  // Modals management
  function openReviewModal() {
    updateReviewGrid();
    els.reviewModal.classList.remove('hidden');
  }

  function openProfileModal() {
    const confidentCount = state.userMastery.confidentQuestions.size;
    els.profAttempts.textContent = state.userMastery.totalAttempts;
    els.profBestScore.textContent = `${state.userMastery.bestScore}%`;
    els.profConfidentCount.textContent = `${confidentCount} / 60`;
    els.profMasteryPct.textContent = `${Math.round((confidentCount / 60) * 100)}%`;

    els.attemptsHistoryList.innerHTML = '';
    if (state.userMastery.recentAttempts.length === 0) {
      els.attemptsHistoryList.innerHTML = '<p class="empty-state">No exam attempts recorded yet.</p>';
    } else {
      state.userMastery.recentAttempts.forEach(att => {
        const row = document.createElement('div');
        row.className = 'attempt-row';
        const dateStr = new Date(att.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        row.innerHTML = `
          <div class="attempt-left">
            <span class="att-badge ${att.passed ? 'pass' : 'fail'}">${att.passed ? 'PASS' : 'FAIL'}</span>
            <strong>${att.percentage}% (${att.score}/${att.total_questions})</strong>
          </div>
          <span style="color: #64748B; font-size: 0.8rem;">${dateStr}</span>
        `;
        els.attemptsHistoryList.appendChild(row);
      });
    }

    els.profileModal.classList.remove('hidden');
  }

  async function openAdminModal() {
    if (state.user?.role !== 'admin') return;

    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        els.admTotalUsers.textContent = data.summary.total_users;
        els.admTotalExams.textContent = data.summary.total_exams_taken;
        els.admAvgScore.textContent = `${data.summary.platform_avg_score}%`;
        els.admPassedExams.textContent = data.summary.total_passed_exams;

        els.adminUsersTableBody.innerHTML = '';
        data.users.forEach(u => {
          const tr = document.createElement('tr');
          const lastActive = u.last_login ? new Date(u.last_login).toLocaleDateString() : '-';
          tr.innerHTML = `
            <td><strong>${u.username}</strong></td>
            <td><span class="role-badge ${u.role}">${u.role}</span></td>
            <td>${u.total_attempts}</td>
            <td>${u.best_score}${u.best_score !== '-' ? '%' : ''}</td>
            <td>${u.avg_score}${u.avg_score !== '-' ? '%' : ''}</td>
            <td><strong>${u.confident_questions}</strong> / 60</td>
            <td>${u.mastery_percentage}%</td>
            <td style="color: #64748B;">${lastActive}</td>
          `;
          els.adminUsersTableBody.appendChild(tr);
        });

        els.adminModal.classList.remove('hidden');
      }
    } catch (err) {
      alert('Could not fetch admin metrics. Please make sure the backend is active.');
    }
  }

  function closeModal() {
    els.reviewModal.classList.add('hidden');
    els.resultsModal.classList.add('hidden');
    els.profileModal.classList.add('hidden');
    els.adminModal.classList.add('hidden');
  }

  function copyExhibit() {
    const text = els.exhibitContent.textContent;
    navigator.clipboard.writeText(text).then(() => {
      els.copyExhibitBtn.textContent = 'Copied!';
      setTimeout(() => { els.copyExhibitBtn.textContent = 'Copy'; }, 1500);
    });
  }

  function adjustFontSize(delta) {
    state.fontScale = Math.min(Math.max(0.85, state.fontScale + delta), 1.35);
    document.documentElement.style.setProperty('--font-scale', `${state.fontScale}rem`);
  }

  // Event Listeners
  function bindEvents() {
    // Auth Tabs
    els.tabLogin.addEventListener('click', () => {
      els.tabLogin.classList.add('active');
      els.tabRegister.classList.remove('active');
      els.formLogin.classList.remove('hidden');
      els.formRegister.classList.add('hidden');
    });

    els.tabRegister.addEventListener('click', () => {
      els.tabRegister.classList.add('active');
      els.tabLogin.classList.remove('active');
      els.formRegister.classList.remove('hidden');
      els.formLogin.classList.add('hidden');
    });

    // Auth Forms
    els.formLogin.addEventListener('submit', handleLoginSubmit);
    els.formRegister.addEventListener('submit', handleRegisterSubmit);
    els.btnLogout.addEventListener('click', logoutUser);

    // Profile & Admin Modals
    els.btnUserProfile.addEventListener('click', openProfileModal);
    els.userMasteryIndicator.addEventListener('click', openProfileModal);
    els.btnAdminPanel.addEventListener('click', openAdminModal);
    els.closeProfileBtn.addEventListener('click', closeModal);
    els.closeAdminBtn.addEventListener('click', closeModal);

    // Navigation
    els.btnPrev.addEventListener('click', () => {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        renderCurrentQuestion();
      }
    });

    els.btnNext.addEventListener('click', () => {
      if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        renderCurrentQuestion();
      }
    });

    // Mark for review
    els.markReviewBtn.addEventListener('click', toggleFlag);

    // Mode Toggle
    els.modeExamBtn.addEventListener('click', () => {
      state.mode = 'exam';
      els.modeExamBtn.classList.add('active');
      els.modeStudyBtn.classList.remove('active');
      renderCurrentQuestion();
    });

    els.modeStudyBtn.addEventListener('click', () => {
      state.mode = 'study';
      els.modeStudyBtn.classList.add('active');
      els.modeExamBtn.classList.remove('active');
      renderCurrentQuestion();
    });

    // Shuffle Toggle
    els.shuffleToggleBtn.addEventListener('click', () => {
      state.isShuffled = !state.isShuffled;
      els.shuffleToggleBtn.classList.toggle('active-toggle', state.isShuffled);
      els.shuffleToggleBtn.textContent = state.isShuffled ? '🔀 Shuffled' : '📋 Sequential';
      if (confirm('Restart exam with new question & option order?')) {
        startNewSession();
      }
    });

    // Font Controls
    els.fontDecrease.addEventListener('click', () => adjustFontSize(-0.08));
    els.fontIncrease.addEventListener('click', () => adjustFontSize(0.08));

    // Modals
    els.btnGridModal.addEventListener('click', openReviewModal);
    els.gridViewBtn.addEventListener('click', openReviewModal);
    els.closeModalBtn.addEventListener('click', closeModal);
    els.modalResumeBtn.addEventListener('click', closeModal);

    // Exam Submission
    els.btnFinish.addEventListener('click', () => {
      const unanswered = state.questions.length - Object.keys(state.userAnswers).filter(k => state.userAnswers[k].size > 0).length;
      const msg = unanswered > 0 
        ? `You still have ${unanswered} unanswered question(s). Are you sure you want to end the exam?` 
        : 'Are you sure you want to end and submit the exam?';
      if (confirm(msg)) {
        finishExam();
      }
    });

    els.modalSubmitBtn.addEventListener('click', () => {
      if (confirm('Submit all answers and view your final score?')) {
        finishExam();
      }
    });

    // Check Answer
    els.btnCheckAnswer.addEventListener('click', checkCurrentAnswer);

    // Copy Exhibit
    els.copyExhibitBtn.addEventListener('click', copyExhibit);

    // Reset / Restart
    els.btnReset.addEventListener('click', () => {
      if (confirm('Restart exam and clear all answers?')) {
        startNewSession();
      }
    });

    // Results Actions
    els.btnReviewAnswers.addEventListener('click', () => {
      closeModal();
      state.mode = 'study';
      els.modeStudyBtn.classList.add('active');
      els.modeExamBtn.classList.remove('active');
      state.currentIndex = 0;
      renderCurrentQuestion();
    });

    els.btnRetakeExam.addEventListener('click', () => {
      closeModal();
      startNewSession();
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight') {
        if (state.currentIndex < state.questions.length - 1) {
          state.currentIndex++;
          renderCurrentQuestion();
        }
      } else if (e.key === 'ArrowLeft') {
        if (state.currentIndex > 0) {
          state.currentIndex--;
          renderCurrentQuestion();
        }
      } else if (e.key.toLowerCase() === 'm') {
        toggleFlag();
      } else if (['1', '2', '3', '4', '5', 'a', 'b', 'c', 'd', 'e'].includes(e.key.toLowerCase())) {
        const map = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4 };
        const optIdx = map[e.key.toLowerCase()];
        const q = state.questions[state.currentIndex];
        if (q && q.options[optIdx]) {
          handleOptionSelection(q, q.options[optIdx].id, q.type === 'multiple_choice');
        }
      }
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
