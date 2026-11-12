/**
 * JobSphere - Main Application JavaScript
 * Connects to all FastAPI endpoints when running on the server, and includes a
 * seamless Serverless / LocalStorage engine so the app also works 100% interactively
 * when hosted publicly on GitHub Pages (https://lawalabdulfatah360-dev.github.io/dsfp6.0/).
 */

const API_BASE = (window.location.port === '8000')
  ? '/api'
  : 'http://127.0.0.1:8000/api';

// Application State
let currentUser = null;
let currentToken = localStorage.getItem('jobtrack_token') || null;
let allJobs = [];
let allAdminJobs = [];
let currentAdminApplications = [];
let selectedJobForApply = null;
let authMode = 'login';
let searchDebounceTimer = null;

// ==========================================================
// SERVERLESS / GITHUB PAGES FALLBACK ENGINE
// Ensures public users on GitHub Pages get full interactivity
// ==========================================================

function getLocalDB() {
  const raw = localStorage.getItem('jobsphere_cloud_db');
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  const initialDB = {
    users: [
      {
        id: 1,
        email: 'admin@jobtrack.com',
        password: 'Admin123!',
        full_name: 'Alexander Vance',
        role: 'admin',
        company_name: 'BlueSky Tech Corp',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        email: 'applicant@example.com',
        password: 'User123!',
        full_name: 'Sarah Connor',
        role: 'applicant',
        company_name: null,
        created_at: new Date().toISOString()
      }
    ],
    jobs: [
      {
        id: 1,
        title: 'Senior Cloud & DevOps Engineer',
        department: 'Infrastructure & Cloud',
        location: 'Remote (Global)',
        job_type: 'Full-time',
        salary_range: '$130,000 - $160,000 / yr',
        experience_level: 'Senior',
        description: 'We are seeking an experienced Cloud Engineer to design, scale, and automate our cloud deployment infrastructure.\n\nKey Responsibilities:\n- Architect resilient infrastructure on AWS/GCP with Terraform\n- Maintain CI/CD automated deployment pipelines\n- Monitor system telemetry, latency, and fault tolerance\n- Partner with security teams to enforce compliance',
        requirements: '- 4+ years of production experience with AWS or GCP\n- Strong proficiency in Docker, Kubernetes, and Terraform\n- Solid background in Python, Bash, or Go\n- Experience with Prometheus, Datadog, or Grafana',
        status: 'Open',
        created_by: 1,
        poster_name: 'Alexander Vance',
        poster_company: 'BlueSky Tech Corp',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Product UI/UX Designer',
        department: 'Product & Design',
        location: 'New York, NY (Hybrid)',
        job_type: 'Full-time',
        salary_range: '$95,000 - $120,000 / yr',
        experience_level: 'Mid Level',
        description: 'Join our core design squad to craft intuitive, delightful user experiences for our next-generation web & mobile products.\n\nKey Responsibilities:\n- Conduct customer research and design interactive prototypes in Figma\n- Build and maintain our light blue design system components\n- Collaborate closely with product managers and engineers',
        requirements: '- 3+ years of experience in digital product design\n- Outstanding portfolio demonstrating web application workflows\n- Expert knowledge of Figma, component variants, and design tokens\n- Strong empathy for user feedback and accessible design (WCAG)',
        status: 'Open',
        created_by: 1,
        poster_name: 'Alexander Vance',
        poster_company: 'BlueSky Tech Corp',
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        title: 'Full-Stack Python & Web Developer',
        department: 'Engineering',
        location: 'San Francisco, CA (or Remote)',
        job_type: 'Full-time',
        salary_range: '$115,000 - $145,000 / yr',
        experience_level: 'Mid Level',
        description: 'Looking for a passionate Full-Stack developer comfortable building high-performance REST APIs and modern web interfaces.\n\nKey Responsibilities:\n- Develop performant microservices using FastAPI and SQLite/PostgreSQL\n- Build responsive, accessible frontend dashboards\n- Write unit and integration tests for core business flows',
        requirements: '- Proficiency in Python 3, FastAPI, or Django/Flask\n- Strong understanding of JavaScript/TypeScript, HTML5, CSS\n- Familiarity with relational database design and query optimization\n- Passion for clean, readable, documented code',
        status: 'Open',
        created_by: 1,
        poster_name: 'Alexander Vance',
        poster_company: 'BlueSky Tech Corp',
        created_at: new Date().toISOString()
      },
      {
        id: 4,
        title: 'Product Growth Marketing Lead',
        department: 'Marketing',
        location: 'Chicago, IL (Hybrid)',
        job_type: 'Full-time',
        salary_range: '$85,000 - $110,000 / yr',
        experience_level: 'Mid Level',
        description: 'Lead customer acquisition, search marketing, and product growth experiments across key B2B channels.',
        requirements: '- 3+ years experience in B2B SaaS growth or performance marketing\n- Data-driven mindset with Google Analytics, Mixpanel, or SQL\n- Excellent written and verbal communication',
        status: 'Open',
        created_by: 1,
        poster_name: 'Alexander Vance',
        poster_company: 'BlueSky Tech Corp',
        created_at: new Date().toISOString()
      }
    ],
    applications: [
      {
        id: 1,
        job_id: 1,
        user_id: 2,
        full_name: 'Sarah Connor',
        email: 'applicant@example.com',
        phone: '+1 (555) 019-2834',
        portfolio_url: 'https://github.com/sarahconnor-cloud',
        cover_letter: 'I am very excited about the Senior Cloud & DevOps Engineer position. I have over 5 years of experience deploying scalable Kubernetes clusters and automated CI/CD pipelines.',
        resume_original_name: 'Sarah_Connor_Resume.pdf',
        status: 'Under Review',
        admin_notes: 'Strong background in Terraform and Kubernetes. High priority for initial screen.',
        applied_at: new Date().toISOString()
      }
    ]
  };
  localStorage.setItem('jobsphere_cloud_db', JSON.stringify(initialDB));
  return initialDB;
}

function saveLocalDB(db) {
  localStorage.setItem('jobsphere_cloud_db', JSON.stringify(db));
}

function getLocalUserFromToken(token) {
  if (!token || !token.startsWith('local-jwt-')) return null;
  const userId = parseInt(token.replace('local-jwt-', ''), 10);
  const db = getLocalDB();
  return db.users.find(u => u.id === userId) || null;
}

async function apiFetch(path, options = {}) {
  // Try live FastAPI server first unless hosted on github.io
  const isGitHubPages = window.location.hostname.includes('github.io');
  if (!isGitHubPages) {
    try {
      const res = await fetch(`${API_BASE}${path}`, options);
      return res;
    } catch (err) {
      // Fall through to serverless local engine if backend is offline
    }
  }
  return handleServerlessRequest(path, options);
}

function makeJsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

async function handleServerlessRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const db = getLocalDB();
  const urlObj = new URL(path, 'http://localhost');
  const pathname = urlObj.pathname;
  const params = urlObj.searchParams;

  const authHeader = options.headers?.['Authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim() || currentToken;
  const activeUser = getLocalUserFromToken(token);

  // 1. POST /auth/login
  if (pathname === '/auth/login' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const user = db.users.find(u => u.email.toLowerCase() === (body.email || '').toLowerCase() && u.password === body.password);
    if (!user) return makeJsonResponse({ detail: 'Incorrect email or password.' }, 401);
    const { password, ...safeUser } = user;
    return makeJsonResponse({ access_token: `local-jwt-${user.id}`, token_type: 'bearer', user: safeUser }, 200);
  }

  // 2. POST /auth/register
  if (pathname === '/auth/register' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    if (db.users.some(u => u.email.toLowerCase() === (body.email || '').toLowerCase())) {
      return makeJsonResponse({ detail: 'An account with this email address already exists.' }, 400);
    }
    const newId = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      email: body.email.toLowerCase().trim(),
      password: body.password,
      full_name: body.full_name.trim(),
      role: body.role || 'applicant',
      company_name: body.company_name || null,
      created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    saveLocalDB(db);
    const { password, ...safeUser } = newUser;
    return makeJsonResponse({ access_token: `local-jwt-${newUser.id}`, token_type: 'bearer', user: safeUser }, 201);
  }

  // 3. GET /auth/me
  if (pathname === '/auth/me' && method === 'GET') {
    if (!activeUser) return makeJsonResponse({ detail: 'Invalid session.' }, 401);
    const { password, ...safeUser } = activeUser;
    return makeJsonResponse({ user: safeUser }, 200);
  }

  // 4. GET /jobs
  if (pathname === '/jobs' && method === 'GET') {
    const q = (params.get('q') || '').toLowerCase();
    const dept = params.get('department') || '';
    const jtype = params.get('job_type') || '';
    const exp = params.get('experience_level') || '';

    let jobs = db.jobs.map(j => {
      const appCount = db.applications.filter(a => a.job_id === j.id).length;
      const hasApplied = activeUser ? db.applications.some(a => a.job_id === j.id && a.user_id === activeUser.id) : false;
      return { ...j, applicant_count: appCount, has_applied: hasApplied };
    });

    if (!activeUser || activeUser.role !== 'admin') {
      jobs = jobs.filter(j => j.status === 'Open');
    }
    if (q) {
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    }
    if (dept) jobs = jobs.filter(j => j.department === dept);
    if (jtype) jobs = jobs.filter(j => j.job_type === jtype);
    if (exp) jobs = jobs.filter(j => j.experience_level === exp);

    return makeJsonResponse({ jobs: jobs.reverse() }, 200);
  }

  // 5. POST /jobs
  if (pathname === '/jobs' && method === 'POST') {
    if (!activeUser || activeUser.role !== 'admin') return makeJsonResponse({ detail: 'Admin required' }, 403);
    const body = JSON.parse(options.body || '{}');
    const newId = db.jobs.length ? Math.max(...db.jobs.map(j => j.id)) + 1 : 1;
    const newJob = {
      id: newId,
      ...body,
      created_by: activeUser.id,
      poster_name: activeUser.full_name,
      poster_company: activeUser.company_name || 'BlueSky Tech Corp',
      created_at: new Date().toISOString()
    };
    db.jobs.push(newJob);
    saveLocalDB(db);
    return makeJsonResponse({ message: 'Job created', job: newJob }, 201);
  }

  // 6. GET / PUT / DELETE /jobs/:id
  const jobMatch = pathname.match(/^\/jobs\/(\d+)$/);
  if (jobMatch) {
    const jobId = parseInt(jobMatch[1], 10);
    const jobIdx = db.jobs.findIndex(j => j.id === jobId);
    if (jobIdx === -1) return makeJsonResponse({ detail: 'Job not found' }, 404);

    if (method === 'GET') {
      const job = db.jobs[jobIdx];
      const myApp = activeUser ? db.applications.find(a => a.job_id === jobId && a.user_id === activeUser.id) : null;
      return makeJsonResponse({
        job: {
          ...job,
          applicant_count: db.applications.filter(a => a.job_id === jobId).length,
          has_applied: Boolean(myApp),
          my_application: myApp || null
        }
      }, 200);
    }

    if (method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      db.jobs[jobIdx] = { ...db.jobs[jobIdx], ...body };
      saveLocalDB(db);
      return makeJsonResponse({ job: db.jobs[jobIdx] }, 200);
    }

    if (method === 'DELETE') {
      db.jobs.splice(jobIdx, 1);
      db.applications = db.applications.filter(a => a.job_id !== jobId);
      saveLocalDB(db);
      return makeJsonResponse({ message: 'Deleted' }, 200);
    }
  }

  // 7. POST /jobs/:id/apply
  const applyMatch = pathname.match(/^\/jobs\/(\d+)\/apply$/);
  if (applyMatch && method === 'POST') {
    if (!activeUser) return makeJsonResponse({ detail: 'Please sign in first.' }, 401);
    const jobId = parseInt(applyMatch[1], 10);
    if (db.applications.some(a => a.job_id === jobId && a.user_id === activeUser.id)) {
      return makeJsonResponse({ detail: 'You have already applied for this position.' }, 400);
    }
    const fd = options.body;
    const resumeFile = fd.get('resume');
    const newId = db.applications.length ? Math.max(...db.applications.map(a => a.id)) + 1 : 1;
    const newApp = {
      id: newId,
      job_id: jobId,
      user_id: activeUser.id,
      full_name: fd.get('full_name'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      portfolio_url: fd.get('portfolio_url') || null,
      cover_letter: fd.get('cover_letter') || null,
      resume_original_name: resumeFile && resumeFile.name ? resumeFile.name : null,
      status: 'Submitted',
      admin_notes: '',
      applied_at: new Date().toISOString()
    };
    db.applications.push(newApp);
    saveLocalDB(db);
    return makeJsonResponse({ message: 'Application submitted', application: newApp }, 201);
  }

  // 8. GET /applications/my
  if (pathname === '/applications/my' && method === 'GET') {
    if (!activeUser) return makeJsonResponse({ applications: [] }, 200);
    const apps = db.applications
      .filter(a => a.user_id === activeUser.id)
      .map(a => {
        const job = db.jobs.find(j => j.id === a.job_id) || {};
        return { ...a, job_title: job.title || 'Job Opening', job_department: job.department || '' };
      })
      .reverse();
    return makeJsonResponse({ applications: apps }, 200);
  }

  // 9. GET /admin/stats
  if (pathname === '/admin/stats' && method === 'GET') {
    const breakdown = {};
    db.applications.forEach(a => { breakdown[a.status] = (breakdown[a.status] || 0) + 1; });
    return makeJsonResponse({
      total_jobs: db.jobs.length,
      open_jobs: db.jobs.filter(j => j.status === 'Open').length,
      total_applications: db.applications.length,
      total_candidates: new Set(db.applications.map(a => a.user_id)).size,
      status_breakdown: breakdown
    }, 200);
  }

  // 10. GET /admin/applications or /admin/jobs/:id/applications
  const jobAppsMatch = pathname.match(/^\/admin\/jobs\/(\d+)\/applications$/);
  if ((pathname === '/admin/applications' || jobAppsMatch) && method === 'GET') {
    let apps = db.applications.map(a => {
      const job = db.jobs.find(j => j.id === a.job_id) || {};
      return { ...a, job_title: job.title || 'Job', job_department: job.department || '' };
    });

    const filterJobId = jobAppsMatch ? parseInt(jobAppsMatch[1], 10) : (params.get('job_id') ? parseInt(params.get('job_id'), 10) : null);
    const filterStatus = params.get('status') || '';
    const search = (params.get('search') || '').toLowerCase();

    if (filterJobId) apps = apps.filter(a => a.job_id === filterJobId);
    if (filterStatus) apps = apps.filter(a => a.status === filterStatus);
    if (search) {
      apps = apps.filter(a =>
        a.full_name.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.job_title.toLowerCase().includes(search)
      );
    }
    return makeJsonResponse({ applications: apps.reverse() }, 200);
  }

  // 11. PATCH /admin/applications/:id/status
  const statusMatch = pathname.match(/^\/admin\/applications\/(\d+)\/status$/);
  if (statusMatch && method === 'PATCH') {
    const appId = parseInt(statusMatch[1], 10);
    const appIdx = db.applications.findIndex(a => a.id === appId);
    if (appIdx === -1) return makeJsonResponse({ detail: 'Application not found' }, 404);
    const body = JSON.parse(options.body || '{}');
    db.applications[appIdx].status = body.status;
    if (body.admin_notes !== undefined) db.applications[appIdx].admin_notes = body.admin_notes;
    saveLocalDB(db);
    return makeJsonResponse({ application: db.applications[appIdx] }, 200);
  }

  return makeJsonResponse({ detail: 'Not found' }, 404);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  await fetchJobs();
  if (window.lucide) {
    lucide.createIcons();
  }
});

// ==========================================================
// 1. AUTHENTICATION MODULE
// ==========================================================

async function initAuth() {
  if (!currentToken) {
    updateAuthUI();
    return;
  }

  try {
    const res = await apiFetch(`/auth/me`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
    } else {
      logout();
    }
  } catch (err) {
    console.error('Failed to verify session:', err);
    logout();
  }
  updateAuthUI();
}

function updateAuthUI() {
  const loggedOutBox = document.getElementById('authLoggedOut');
  const loggedInBox = document.getElementById('authLoggedIn');
  const navMyApps = document.getElementById('nav-my-apps');
  const navAdmin = document.getElementById('nav-admin');
  const adminJobActionBtn = document.getElementById('adminJobActionBtn');
  const activeUserNotice = document.getElementById('activeUserNotice');

  if (currentUser) {
    loggedOutBox.style.display = 'none';
    loggedInBox.style.display = 'flex';

    document.getElementById('navUserName').textContent = currentUser.full_name;

    const roleBadgeHtml = currentUser.role === 'admin'
      ? `<span class="role-badge admin"><i data-lucide="shield" style="width:12px;height:12px;"></i> Admin / Employer</span>`
      : `<span class="role-badge applicant"><i data-lucide="user" style="width:12px;height:12px;"></i> Job Seeker</span>`;
    document.getElementById('navUserRole').innerHTML = roleBadgeHtml;

    if (currentUser.role === 'admin') {
      navAdmin.style.display = 'inline-flex';
      navMyApps.style.display = 'none';
      if (adminJobActionBtn) adminJobActionBtn.style.display = 'block';
    } else {
      navAdmin.style.display = 'none';
      navMyApps.style.display = 'inline-flex';
      if (adminJobActionBtn) adminJobActionBtn.style.display = 'none';
    }

    activeUserNotice.innerHTML = `Active: <strong>${currentUser.full_name}</strong> (${currentUser.role})`;
  } else {
    loggedOutBox.style.display = 'flex';
    loggedInBox.style.display = 'none';
    navMyApps.style.display = 'none';
    navAdmin.style.display = 'none';
    if (adminJobActionBtn) adminJobActionBtn.style.display = 'none';
    activeUserNotice.innerHTML = `Logged in: <em>None (Guest)</em>`;
  }

  if (window.lucide) lucide.createIcons();
}

function openAuthModal(mode = 'login') {
  setAuthMode(mode);
  document.getElementById('authErrorNotice').style.display = 'none';
  document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
  document.getElementById('authForm').reset();
}

function setAuthMode(mode) {
  authMode = mode;
  const loginTab = document.getElementById('authTabLogin');
  const regTab = document.getElementById('authTabRegister');
  const regFields = document.getElementById('registerFields');
  const modalTitle = document.getElementById('authModalTitle');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (mode === 'register') {
    loginTab.style.background = 'transparent';
    regTab.style.background = 'var(--white)';
    regFields.style.display = 'flex';
    modalTitle.textContent = 'Create an Account';
    submitBtn.textContent = 'Create Account';
  } else {
    loginTab.style.background = 'var(--white)';
    regTab.style.background = 'transparent';
    regFields.style.display = 'none';
    modalTitle.textContent = 'Sign In to JobSphere';
    submitBtn.textContent = 'Sign In';
  }
}

function toggleCompanyField() {
  const role = document.getElementById('authRole').value;
  const companyGroup = document.getElementById('companyFieldGroup');
  companyGroup.style.display = (role === 'admin') ? 'flex' : 'none';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('authErrorNotice');
  errorDiv.style.display = 'none';

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  try {
    let res;
    if (authMode === 'register') {
      const full_name = document.getElementById('authFullName').value.trim();
      const role = document.getElementById('authRole').value;
      const company_name = document.getElementById('authCompany').value.trim();

      if (!full_name) {
        throw new Error('Please enter your full name.');
      }

      res = await apiFetch(`/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, role, company_name: company_name || null })
      });
    } else {
      res = await apiFetch(`/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Authentication failed.');
    }

    currentToken = data.access_token;
    localStorage.setItem('jobtrack_token', currentToken);
    currentUser = data.user;

    closeAuthModal();
    updateAuthUI();
    showToast(`Welcome, ${currentUser.full_name}!`, 'success');

    await fetchJobs();
    if (currentUser.role === 'admin') {
      navigate('admin');
    } else {
      navigate('jobs');
    }

  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = 'block';
  }
}

async function quickLogin(email, password) {
  try {
    const res = await apiFetch(`/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Demo login failed.');

    currentToken = data.access_token;
    localStorage.setItem('jobtrack_token', currentToken);
    currentUser = data.user;

    updateAuthUI();
    showToast(`Switched account to: ${currentUser.full_name} (${currentUser.role})`, 'success');

    await fetchJobs();
    if (currentUser.role === 'admin') {
      navigate('admin');
    } else {
      navigate('jobs');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function logout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem('jobtrack_token');
  updateAuthUI();
  navigate('jobs');
  fetchJobs();
  showToast('You have been logged out.', 'success');
}

// ==========================================================
// 2. NAVIGATION & VIEW SWITCHING
// ==========================================================

function navigate(viewName) {
  const views = ['jobs', 'my-applications', 'admin'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const navEl = document.getElementById(`nav-${v === 'my-applications' ? 'my-apps' : v}`);
    if (el) el.style.display = (v === viewName) ? 'block' : 'none';
    if (navEl) {
      if (v === viewName) navEl.classList.add('active');
      else navEl.classList.remove('active');
    }
  });

  const hero = document.getElementById('heroSection');
  const searchBar = document.getElementById('searchFilterBar');

  if (viewName === 'jobs') {
    hero.style.display = 'block';
    searchBar.style.display = 'flex';
    fetchJobs();
  } else if (viewName === 'my-applications') {
    hero.style.display = 'none';
    searchBar.style.display = 'none';
    fetchMyApplications();
  } else if (viewName === 'admin') {
    hero.style.display = 'none';
    searchBar.style.display = 'none';
    initAdminDashboard();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================
// 3. JOB LISTINGS & SEARCH FILTERING
// ==========================================================

function handleSearchInput() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    fetchJobs();
  }, 300);
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterDepartment').value = '';
  document.getElementById('filterJobType').value = '';
  document.getElementById('filterExperience').value = '';
  fetchJobs();
}

async function fetchJobs() {
  const q = document.getElementById('searchInput')?.value.trim() || '';
  const department = document.getElementById('filterDepartment')?.value || '';
  const job_type = document.getElementById('filterJobType')?.value || '';
  const experience_level = document.getElementById('filterExperience')?.value || '';

  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (department) params.append('department', department);
  if (job_type) params.append('job_type', job_type);
  if (experience_level) params.append('experience_level', experience_level);

  const headers = {};
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  try {
    const res = await apiFetch(`/jobs?${params.toString()}`, { headers });
    const data = await res.json();
    allJobs = data.jobs || [];
    renderJobs(allJobs);
  } catch (err) {
    console.error('Error fetching jobs:', err);
    showToast('Failed to load job listings.', 'error');
  }
}

function renderJobs(jobs) {
  const grid = document.getElementById('jobsGrid');
  const notice = document.getElementById('jobCountNotice');

  notice.textContent = `Showing ${jobs.length} position${jobs.length === 1 ? '' : 's'}`;

  if (!jobs.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: var(--white); border-radius: var(--radius-lg); border: 1px dashed var(--slate-300);">
        <i data-lucide="search-x" style="width: 48px; height: 48px; color: var(--slate-400); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem;">No job openings found</h3>
        <p style="color: var(--slate-500); font-size: 0.9rem;">Try adjusting your search criteria or resetting filters.</p>
        <button class="btn btn-outline btn-sm" onclick="resetFilters()" style="margin-top: 1rem;">
          Clear Filters
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  grid.innerHTML = jobs.map(job => {
    const appliedBadge = job.has_applied
      ? `<span class="status-badge submitted"><i data-lucide="check" style="width:13px;height:13px;"></i> Applied</span>`
      : '';

    const adminOptions = (currentUser && currentUser.role === 'admin')
      ? `<div style="display:flex; gap:0.35rem;">
           <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openEditJobModal(${job.id})" title="Edit Job">
             <i data-lucide="edit-3" style="width:13px;height:13px;"></i>
           </button>
           <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteJobOpening(${job.id})" title="Delete Job">
             <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
           </button>
         </div>`
      : '';

    return `
      <div class="job-card" onclick="openJobDetailModal(${job.id})">
        <div class="job-card-header">
          <div>
            <div class="job-department">${escapeHtml(job.department)}</div>
            <h3 class="job-title">${escapeHtml(job.title)}</h3>
          </div>
          ${appliedBadge || adminOptions}
        </div>

        <div class="job-meta-pills">
          <span class="meta-pill"><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${escapeHtml(job.location)}</span>
          <span class="meta-pill"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${escapeHtml(job.job_type)}</span>
          ${job.experience_level ? `<span class="meta-pill"><i data-lucide="award" style="width:12px;height:12px;"></i> ${escapeHtml(job.experience_level)}</span>` : ''}
          ${job.salary_range ? `<span class="meta-pill salary"><i data-lucide="banknote" style="width:12px;height:12px;"></i> ${escapeHtml(job.salary_range)}</span>` : ''}
        </div>

        <p class="job-description-preview">${escapeHtml(job.description)}</p>

        <div class="job-card-footer">
          <div class="job-date">Posted ${formatDate(job.created_at)}</div>
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openJobDetailModal(${job.id})">
            View Details <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================================
// 4. JOB DETAILS & APPLICATION MODAL
// ==========================================================

async function openJobDetailModal(jobId) {
  const headers = {};
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  try {
    const res = await apiFetch(`/jobs/${jobId}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Could not load job details.');

    const job = data.job;
    selectedJobForApply = job;

    document.getElementById('detailJobTitle').textContent = job.title;
    document.getElementById('detailJobMeta').textContent = `${job.department} • ${job.poster_company || 'JobSphere Employer'}`;
    document.getElementById('detailJobBadge').textContent = job.status;
    document.getElementById('detailJobBadge').className = `status-badge ${job.status.toLowerCase()}`;

    const pillsContainer = document.getElementById('detailPills');
    pillsContainer.innerHTML = `
      <span class="meta-pill"><i data-lucide="map-pin" style="width:13px;height:13px;"></i> ${escapeHtml(job.location)}</span>
      <span class="meta-pill"><i data-lucide="briefcase" style="width:13px;height:13px;"></i> ${escapeHtml(job.job_type)}</span>
      ${job.experience_level ? `<span class="meta-pill"><i data-lucide="award" style="width:13px;height:13px;"></i> ${escapeHtml(job.experience_level)}</span>` : ''}
      ${job.salary_range ? `<span class="meta-pill salary"><i data-lucide="banknote" style="width:13px;height:13px;"></i> ${escapeHtml(job.salary_range)}</span>` : ''}
    `;

    document.getElementById('detailJobDescription').textContent = job.description;

    const reqsSection = document.getElementById('detailRequirementsSection');
    if (job.requirements && job.requirements.trim()) {
      reqsSection.style.display = 'block';
      document.getElementById('detailJobRequirements').textContent = job.requirements;
    } else {
      reqsSection.style.display = 'none';
    }

    const applyBtn = document.getElementById('detailApplyBtn');
    if (job.has_applied) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = `<i data-lucide="check-circle" style="width:16px;height:16px;"></i> Already Applied (${job.my_application ? job.my_application.status : 'Submitted'})`;
    } else if (job.status !== 'Open') {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applications Closed';
    } else {
      applyBtn.disabled = false;
      applyBtn.innerHTML = `Apply for this Position <i data-lucide="arrow-right" style="width:16px;height:16px;"></i>`;
    }

    document.getElementById('jobDetailModal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeJobDetailModal() {
  document.getElementById('jobDetailModal').classList.remove('active');
}

function proceedToApply() {
  closeJobDetailModal();

  if (!currentUser) {
    showToast('Please sign in or create an applicant account to apply.', 'error');
    openAuthModal('login');
    return;
  }

  if (currentUser.role === 'admin') {
    showToast('You are signed in as an Admin. Switch to the Applicant Demo account to test applying.', 'error');
    return;
  }

  openApplyModal(selectedJobForApply.id);
}

function openApplyModal(jobId) {
  const job = allJobs.find(j => j.id === jobId) || selectedJobForApply;
  if (!job) return;

  document.getElementById('applyJobId').value = job.id;
  document.getElementById('applyModalSub').textContent = `Applying for: ${job.title} (${job.department})`;

  if (currentUser) {
    document.getElementById('applyFullName').value = currentUser.full_name || '';
    document.getElementById('applyEmail').value = currentUser.email || '';
  }

  document.getElementById('applyResume').value = '';
  document.getElementById('resumeUploadLabel').textContent = 'Click to browse or drop your resume file';
  document.getElementById('applyModal').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeApplyModal() {
  document.getElementById('applyModal').classList.remove('active');
  document.getElementById('applyForm').reset();
}

function handleResumeSelected(e) {
  const file = e.target.files[0];
  const label = document.getElementById('resumeUploadLabel');
  if (file) {
    label.innerHTML = `Selected: <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
  } else {
    label.textContent = 'Click to browse or drop your resume file';
  }
}

async function submitApplication(e) {
  e.preventDefault();
  const btn = document.getElementById('submitAppBtn');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" style="width:16px;height:16px;"></i> Submitting...`;

  const jobId = document.getElementById('applyJobId').value;
  const formData = new FormData();
  formData.append('full_name', document.getElementById('applyFullName').value.trim());
  formData.append('email', document.getElementById('applyEmail').value.trim());
  formData.append('phone', document.getElementById('applyPhone').value.trim());

  const portfolio = document.getElementById('applyPortfolio').value.trim();
  if (portfolio) formData.append('portfolio_url', portfolio);

  const cover = document.getElementById('applyCoverLetter').value.trim();
  if (cover) formData.append('cover_letter', cover);

  const fileInput = document.getElementById('applyResume');
  if (fileInput.files.length > 0) {
    formData.append('resume', fileInput.files[0]);
  }

  try {
    const res = await apiFetch(`/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to submit application.');

    closeApplyModal();
    showToast('Your application was submitted successfully!', 'success');
    await fetchJobs();
    navigate('my-applications');

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" style="width:16px;height:16px;"></i> Submit Application`;
    if (window.lucide) lucide.createIcons();
  }
}

// ==========================================================
// 5. APPLICANT PORTAL: MY APPLICATIONS & STATUS TRACKER
// ==========================================================

async function fetchMyApplications() {
  if (!currentToken) return;

  try {
    const res = await apiFetch(`/applications/my`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    renderMyApplications(data.applications || []);
  } catch (err) {
    console.error('Error fetching applications:', err);
    showToast('Failed to load your applications.', 'error');
  }
}

function renderMyApplications(apps) {
  const container = document.getElementById('myApplicationsContainer');

  if (!apps.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; background: var(--white); border-radius: var(--radius-lg); border: 1px dashed var(--slate-300);">
        <i data-lucide="file-question" style="width: 48px; height: 48px; color: var(--slate-400); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem;">No applications submitted yet</h3>
        <p style="color: var(--slate-500); font-size: 0.9rem;">Browse active openings and apply to track your status here in real time.</p>
        <button class="btn btn-primary btn-sm" onclick="navigate('jobs')" style="margin-top: 1rem;">
          Browse Open Positions
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = apps.map(app => {
    const stages = ['Submitted', 'Under Review', 'Interview Scheduled', 'Offer Extended'];
    const currentIdx = stages.indexOf(app.status);
    const isRejected = app.status === 'Rejected';

    const stepperHtml = isRejected ? `
      <div style="background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:var(--radius-md); padding:0.85rem; display:flex; align-items:center; gap:0.75rem; margin:1rem 0;">
        <i data-lucide="alert-circle" style="color:var(--danger-text); width:20px; height:20px;"></i>
        <div>
          <div style="font-weight:700; font-size:0.9rem; color:var(--danger-text);">Status: Application Not Selected</div>
          <div style="font-size:0.82rem; color:var(--slate-600);">Thank you for your interest. The hiring team has decided to proceed with other candidates for this specific position.</div>
        </div>
      </div>
    ` : `
      <div class="tracker-stepper">
        ${stages.map((stage, idx) => {
          let nodeClass = '';
          if (idx < currentIdx) nodeClass = 'completed';
          else if (idx === currentIdx) nodeClass = 'current';

          return `
            <div class="step-node ${nodeClass}">
              <div class="step-circle">
                ${idx < currentIdx ? '<i data-lucide="check" style="width:16px;height:16px;"></i>' : (idx + 1)}
              </div>
              <div class="step-label">${stage}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    return `
      <div class="job-card" style="margin-bottom:1.5rem; cursor:default;">
        <div class="job-card-header">
          <div>
            <div class="job-department">${escapeHtml(app.job_department)}</div>
            <h3 class="job-title">${escapeHtml(app.job_title)}</h3>
            <div style="font-size:0.85rem; color:var(--slate-500); margin-top:0.25rem;">
              Applied on ${formatDate(app.applied_at)} • Contact: ${escapeHtml(app.email)} (${escapeHtml(app.phone)})
            </div>
          </div>
          <span class="status-badge ${getStatusBadgeClass(app.status)}">${escapeHtml(app.status)}</span>
        </div>

        ${stepperHtml}

        ${app.admin_notes ? `
          <div style="background:var(--primary-bg); border:1px solid #bae6fd; border-radius:var(--radius-md); padding:0.85rem; margin-top:0.75rem;">
            <div style="font-weight:700; font-size:0.8rem; color:var(--primary); text-transform:uppercase; margin-bottom:0.25rem;">
              <i data-lucide="message-square" style="width:13px;height:13px;display:inline-block;vertical-align:middle;"></i> Note from Hiring Team:
            </div>
            <div style="font-size:0.88rem; color:var(--slate-700);">${escapeHtml(app.admin_notes)}</div>
          </div>
        ` : ''}

        ${app.resume_original_name ? `
          <div style="margin-top:1rem; display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--slate-600);">
            <i data-lucide="paperclip" style="width:14px;height:14px;color:var(--primary);"></i>
            <span>Resume attached: <strong>${escapeHtml(app.resume_original_name)}</strong></span>
            <a href="${API_BASE}/applications/${app.id}/resume?token=${encodeURIComponent(currentToken || '')}" target="_blank" class="btn btn-outline btn-sm" style="margin-left:auto; padding:0.2rem 0.5rem; font-size:0.75rem;">
              <i data-lucide="download" style="width:12px;height:12px;"></i> Download
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================================
// 6. ADMIN ATS DASHBOARD
// ==========================================================

async function initAdminDashboard() {
  if (!currentUser || currentUser.role !== 'admin') {
    navigate('jobs');
    return;
  }

  await fetchAdminStats();
  await fetchAdminJobs();
  await fetchAdminApplications();
}

async function fetchAdminStats() {
  try {
    const res = await apiFetch(`/admin/stats`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (!res.ok) return;

    document.getElementById('statTotalJobs').textContent = data.open_jobs;
    document.getElementById('statTotalApps').textContent = data.total_applications;
    document.getElementById('statInReview').textContent = (data.status_breakdown['Under Review'] || 0) + (data.status_breakdown['Submitted'] || 0);
    document.getElementById('statOffered').textContent = data.status_breakdown['Offer Extended'] || 0;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function switchAdminTab(tab) {
  const appsSection = document.getElementById('adminTabApps');
  const jobsSection = document.getElementById('adminTabJobs');
  const appsBtn = document.getElementById('adminTabAppsBtn');
  const jobsBtn = document.getElementById('adminTabJobsBtn');

  if (tab === 'jobs') {
    appsSection.style.display = 'none';
    jobsSection.style.display = 'block';
    appsBtn.className = 'btn btn-secondary btn-sm';
    jobsBtn.className = 'btn btn-outline btn-sm';
    fetchAdminJobs();
  } else {
    appsSection.style.display = 'block';
    jobsSection.style.display = 'none';
    appsBtn.className = 'btn btn-outline btn-sm';
    jobsBtn.className = 'btn btn-secondary btn-sm';
    fetchAdminApplications();
  }
}

async function fetchAdminJobs() {
  try {
    const res = await apiFetch(`/jobs`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    allAdminJobs = data.jobs || [];

    const select = document.getElementById('adminAppJobFilter');
    select.innerHTML = '<option value="">All Job Postings</option>' +
      allAdminJobs.map(j => `<option value="${j.id}">${escapeHtml(j.title)}</option>`).join('');

    renderAdminJobsTable(allAdminJobs);
  } catch (err) {
    console.error('Failed to fetch admin jobs:', err);
  }
}

function renderAdminJobsTable(jobs) {
  const tbody = document.getElementById('adminJobsTableBody');
  if (!jobs.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--slate-400);">No jobs posted yet. Click 'Post New Job' to begin.</td></tr>`;
    return;
  }

  tbody.innerHTML = jobs.map(job => `
    <tr>
      <td>
        <strong style="color:var(--slate-900); font-size:0.95rem;">${escapeHtml(job.title)}</strong>
        <div style="font-size:0.75rem; color:var(--slate-400);">Posted ${formatDate(job.created_at)}</div>
      </td>
      <td>${escapeHtml(job.department)}</td>
      <td>${escapeHtml(job.location)} <span class="meta-pill" style="font-size:0.75rem;">${escapeHtml(job.job_type)}</span></td>
      <td>
        <span class="role-badge admin" style="cursor:pointer;" onclick="filterByJobInApps(${job.id})">
          <i data-lucide="users" style="width:12px;height:12px;"></i> ${job.applicant_count} Applicants
        </span>
      </td>
      <td>
        <span class="status-badge ${job.status.toLowerCase()}">${escapeHtml(job.status)}</span>
      </td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="openEditJobModal(${job.id})" title="Edit Job Details">
            <i data-lucide="edit-2" style="width:13px;height:13px;"></i> Edit
          </button>
          <button class="btn btn-outline btn-sm" onclick="toggleJobStatus(${job.id}, '${job.status}')" title="Toggle Open/Closed">
            ${job.status === 'Open' ? 'Close' : 'Reopen'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteJobOpening(${job.id})" title="Delete Posting">
            <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function filterByJobInApps(jobId) {
  switchAdminTab('applications');
  document.getElementById('adminAppJobFilter').value = jobId;
  fetchAdminApplications();
}

async function fetchAdminApplications() {
  const search = document.getElementById('adminAppSearch')?.value.trim() || '';
  const status = document.getElementById('adminAppStatusFilter')?.value || '';
  const jobId = document.getElementById('adminAppJobFilter')?.value || '';

  try {
    let url;
    if (jobId && !search && !status) {
      url = `/admin/jobs/${jobId}/applications`;
    } else {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (jobId) params.append('job_id', jobId);
      url = `/admin/applications?${params.toString()}`;
    }

    const res = await apiFetch(url, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    currentAdminApplications = data.applications || [];
    renderAdminApplicationsTable(currentAdminApplications);
  } catch (err) {
    console.error('Failed to fetch admin applications:', err);
  }
}

function renderAdminApplicationsTable(apps) {
  const tbody = document.getElementById('adminAppsTableBody');
  if (!apps.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--slate-400);">No applications matching this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => `
    <tr>
      <td>
        <strong style="color:var(--slate-900);">${escapeHtml(app.full_name)}</strong>
        <div style="font-size:0.8rem; color:var(--slate-500);">${escapeHtml(app.email)} • ${escapeHtml(app.phone)}</div>
      </td>
      <td>
        <strong style="color:var(--primary); font-size:0.9rem;">${escapeHtml(app.job_title)}</strong>
        <div style="font-size:0.75rem; color:var(--slate-400);">${escapeHtml(app.job_department)}</div>
      </td>
      <td>${formatDate(app.applied_at)}</td>
      <td>
        <span class="status-badge ${getStatusBadgeClass(app.status)}">${escapeHtml(app.status)}</span>
      </td>
      <td>
        ${app.resume_original_name ? `
          <a href="${API_BASE}/applications/${app.id}/resume?token=${encodeURIComponent(currentToken || '')}" target="_blank" class="btn btn-outline btn-sm" style="font-size:0.78rem; padding:0.25rem 0.55rem;">
            <i data-lucide="file-text" style="width:13px;height:13px;"></i> Resume
          </a>
        ` : `<span style="color:var(--slate-400); font-size:0.8rem;">None</span>`}
      </td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openReviewModal(${app.id})">
          <i data-lucide="eye" style="width:13px;height:13px;"></i> Review Candidate
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function openReviewModal(appId) {
  const app = currentAdminApplications.find(a => a.id === appId);
  if (!app) return;

  document.getElementById('reviewAppId').value = app.id;
  document.getElementById('reviewCandidateName').textContent = app.full_name;
  document.getElementById('reviewCandidateJob').textContent = `Applied for: ${app.job_title} (${app.job_department}) on ${formatDate(app.applied_at)}`;
  document.getElementById('reviewEmail').textContent = app.email;
  document.getElementById('reviewPhone').textContent = app.phone;

  const portfolioDiv = document.getElementById('reviewPortfolio');
  if (app.portfolio_url) {
    portfolioDiv.innerHTML = `<a href="${escapeHtml(app.portfolio_url)}" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:none;">View Link ↗</a>`;
  } else {
    portfolioDiv.textContent = 'None provided';
  }

  const resumeDiv = document.getElementById('reviewResumeBtn');
  if (app.resume_original_name) {
    resumeDiv.innerHTML = `<a href="${API_BASE}/applications/${app.id}/resume?token=${encodeURIComponent(currentToken || '')}" target="_blank" class="btn btn-outline btn-sm">
      <i data-lucide="download" style="width:13px;height:13px;"></i> Download ${escapeHtml(app.resume_original_name)}
    </a>`;
  } else {
    resumeDiv.textContent = 'No file attached';
  }

  document.getElementById('reviewCoverLetter').textContent = app.cover_letter || 'No cover letter submitted.';
  document.getElementById('reviewStatusSelect').value = app.status;
  document.getElementById('reviewAdminNotes').value = app.admin_notes || '';

  document.getElementById('candidateReviewModal').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeReviewModal() {
  document.getElementById('candidateReviewModal').classList.remove('active');
}

async function saveApplicationEvaluation() {
  const appId = document.getElementById('reviewAppId').value;
  const status = document.getElementById('reviewStatusSelect').value;
  const admin_notes = document.getElementById('reviewAdminNotes').value;

  try {
    const res = await apiFetch(`/admin/applications/${appId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ status, admin_notes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update candidate status.');

    closeReviewModal();
    showToast(`Updated candidate status to "${status}".`, 'success');
    await fetchAdminStats();
    await fetchAdminApplications();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================
// 7. POST / EDIT JOB OPENINGS (ADMIN)
// ==========================================================

function openCreateJobModal() {
  document.getElementById('jobForm').reset();
  document.getElementById('editJobId').value = '';
  document.getElementById('jobFormTitle').textContent = 'Post New Job Opening';
  document.getElementById('saveJobBtn').innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i> Publish Job Opening`;
  document.getElementById('jobFormModal').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function openEditJobModal(jobId) {
  const job = allJobs.find(j => j.id === jobId) || allAdminJobs.find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('editJobId').value = job.id;
  document.getElementById('jobFormTitle').textContent = 'Edit Job Opening';
  document.getElementById('jobInputTitle').value = job.title;
  document.getElementById('jobInputDept').value = job.department;
  document.getElementById('jobInputLocation').value = job.location;
  document.getElementById('jobInputType').value = job.job_type;
  document.getElementById('jobInputExp').value = job.experience_level || 'Mid Level';
  document.getElementById('jobInputSalary').value = job.salary_range || '';
  document.getElementById('jobInputStatus').value = job.status;
  document.getElementById('jobInputDesc').value = job.description;
  document.getElementById('jobInputReqs').value = job.requirements || '';

  document.getElementById('saveJobBtn').innerHTML = `<i data-lucide="save" style="width:16px;height:16px;"></i> Update Job Opening`;
  document.getElementById('jobFormModal').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeJobFormModal() {
  document.getElementById('jobFormModal').classList.remove('active');
  document.getElementById('jobForm').reset();
}

async function saveJobOpening(e) {
  e.preventDefault();
  const editId = document.getElementById('editJobId').value;
  const isEdit = Boolean(editId);

  const payload = {
    title: document.getElementById('jobInputTitle').value.trim(),
    department: document.getElementById('jobInputDept').value.trim(),
    location: document.getElementById('jobInputLocation').value.trim(),
    job_type: document.getElementById('jobInputType').value,
    experience_level: document.getElementById('jobInputExp').value,
    salary_range: document.getElementById('jobInputSalary').value.trim() || null,
    status: document.getElementById('jobInputStatus').value,
    description: document.getElementById('jobInputDesc').value.trim(),
    requirements: document.getElementById('jobInputReqs').value.trim() || null
  };

  try {
    const url = isEdit ? `/jobs/${editId}` : `/jobs`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to save job opening.');

    closeJobFormModal();
    showToast(isEdit ? 'Job opening updated successfully.' : 'New job opening published!', 'success');

    await fetchJobs();
    if (currentUser && currentUser.role === 'admin') {
      await fetchAdminJobs();
      await fetchAdminStats();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleJobStatus(jobId, currentStatus) {
  const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
  try {
    const res = await apiFetch(`/jobs/${jobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update job status.');

    showToast(`Job status set to ${newStatus}.`, 'success');
    await fetchJobs();
    await fetchAdminJobs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteJobOpening(jobId) {
  if (!confirm('Are you sure you want to delete this job opening? All associated applications will also be deleted.')) {
    return;
  }

  try {
    const res = await apiFetch(`/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete job opening.');

    showToast('Job opening deleted.', 'success');
    await fetchJobs();
    if (currentUser && currentUser.role === 'admin') {
      await fetchAdminJobs();
      await fetchAdminStats();
      await fetchAdminApplications();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================
// 8. HELPERS & UTILITIES
// ==========================================================

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Submitted': return 'submitted';
    case 'Under Review': return 'under-review';
    case 'Interview Scheduled': return 'interview-scheduled';
    case 'Offer Extended': return 'offer-extended';
    case 'Rejected': return 'rejected';
    default: return 'open';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconName = (type === 'success') ? 'check-circle' : 'alert-circle';
  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width:20px;height:20px;color:${type === 'success' ? '#10b981' : '#ef4444'};"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
