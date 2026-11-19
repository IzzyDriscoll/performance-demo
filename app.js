// Neutreeno Performance — prototype app.
// Everything runs in the browser. Data is saved in the browser's local storage.
(function () {
  'use strict';

  const FW = window.FRAMEWORK;
  const LEVELS = FW.levels;
  const STORE = 'neutreeno-performance-demo-v1';
  const ui = { onlyDiffs: false, goalFilter: null, showGoalForm: false, meetingDraft: null, fwRole: 'ops' };
  let state = loadState();
  let lastHash = null;

  // ---------------------------------------------------------------- storage
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && s.version === 4) return s;
    } catch (e) { /* fall through to demo data */ }
    const fresh = window.buildDemoState(FW);
    localStorage.setItem(STORE, JSON.stringify(fresh));
    return fresh;
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(state)); }

  // ---------------------------------------------------------------- helpers
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const person = (id) => state.people.find((p) => p.id === id);
  const me = () => person(state.viewAs);
  const firstName = (p) => (p ? p.name.split(' ')[0] : '');
  const reportsOf = (id) => state.people.filter((p) => p.leadId === id);
  const isLead = (id) => reportsOf(id).length > 0;
  const hasScorecard = (p) => !!(p && p.role);
  // ---- the org tree ----
  const isOps = (id) => !!(person(id) && person(id).opsAccess);
  // Everyone below someone in the tree (direct reports, their reports, and so on)
  function below(id) {
    const out = [];
    const walk = (x) => reportsOf(x).forEach((p) => { out.push(p); walk(p.id); });
    walk(id);
    return out;
  }
  const isDirectLead = (viewer, emp) => !!(person(emp) && person(emp).leadId === viewer);
  function isAbove(viewer, emp) {
    let p = person(emp);
    const seen = new Set();
    while (p && p.leadId && !seen.has(p.id)) { seen.add(p.id); if (p.leadId === viewer) return true; p = person(p.leadId); }
    return false;
  }
  // Read-only access to someone else's reviews: anyone above them in the tree, or Ops
  const canOversee = (viewer, emp) => viewer !== emp && (isAbove(viewer, emp) || isOps(viewer));
  const seniorityText = (p) => (p.seniority ? ' · ' + p.seniority : '');
  const sectionsFor = (p) => FW.companySections.concat(p.role ? FW.roles[p.role].sections : []);
  const openCycle = () => state.cycles.find((c) => c.status === 'open');
  const cycleById = (id) => state.cycles.find((c) => c.id === id);
  const reviewKey = (c, e, t) => c + ':' + e + ':' + t;
  const getReview = (c, e, t) => state.reviews.find((r) => r.id === reviewKey(c, e, t));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const isSubmitted = (r) => !!(r && r.status === 'submitted');

  function ensureReview(c, e, t) {
    let r = getReview(c, e, t);
    if (!r) {
      const p = person(e);
      r = {
        id: reviewKey(c, e, t), cycleId: c, employeeId: e, type: t,
        reviewerId: t === 'self' ? e : p.leadId,
        answers: {}, comments: {}, strengths: ['', '', ''], improvements: ['', '', ''], kpis: [],
        status: 'not_started', submittedAt: null,
      };
      state.reviews.push(r);
    }
    return r;
  }
  function outcome(c, e) {
    const k = c + ':' + e;
    if (!state.outcomes[k]) state.outcomes[k] = { discussed: false, date: '', notes: '', transcript: '' };
    return state.outcomes[k];
  }

  // ---------------------------------------------------------------- grading
  // A section's grade is the average of its lines, rounded to the nearest level.
  // An area's grade (Culture / Deliverables / Skills) is the average of its section grades, rounded.
  const roundLevel = (x) => Math.max(0, Math.min(4, Math.floor(x + 0.5 + 1e-9)));
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

  function sectionScore(sec, answers) {
    const vals = sec.traits.map((t) => answers[sec.id + '::' + t.id]).filter((v) => v !== undefined && v !== null);
    const total = sec.traits.length;
    if (!vals.length) return { answered: 0, total, avg: null, level: null, complete: false };
    const avg = mean(vals);
    return { answered: vals.length, total, avg, level: roundLevel(avg), complete: vals.length === total };
  }
  const verdictFor = (level, bar) => (level < bar ? 'Underperformer' : level > bar ? 'A-player' : 'Above the Bar');
  function overallFor(verdicts) {
    if (verdicts.includes('Underperformer')) return 'Underperformer';
    if (verdicts.filter((v) => v === 'A-player').length >= 2) return 'A-player';
    return 'Above the Bar';
  }
  function scoreReview(p, answers) {
    const res = { areas: {}, answered: 0, total: 0 };
    for (const area of FW.areas) {
      const secs = sectionsFor(p).filter((s) => s.area === area);
      const scores = secs.map((s) => sectionScore(s, answers));
      scores.forEach((x) => { res.answered += x.answered; res.total += x.total; });
      const scored = scores.filter((x) => x.level !== null);
      const complete = scores.every((x) => x.complete);
      const avg = scored.length ? mean(scored.map((x) => x.level)) : null;
      const level = avg === null ? null : roundLevel(avg);
      const bar = FW.talentBar[p.seniority][area];
      res.areas[area] = { avg, level, bar, complete, verdict: complete ? verdictFor(level, bar) : null };
      res.areas[area].sections = secs.map((s, i) => Object.assign({ sec: s }, scores[i]));
    }
    const verdicts = FW.areas.map((a) => res.areas[a].verdict);
    res.complete = verdicts.every(Boolean);
    res.overall = res.complete ? overallFor(verdicts) : null;
    return res;
  }

  // ---------------------------------------------------------------- permissions
  function canEdit(r) {
    return r.status !== 'submitted' && r.reviewerId === state.viewAs && cycleById(r.cycleId).status === 'open';
  }
  // Who can see a review:
  //  - the person writing it (self-review: you; team lead review: your direct team lead)
  //  - you, for your own team lead review, once your review discussion has been held
  //  - your direct team lead, for your self-review, once they've submitted theirs (so they're not anchored by it)
  //  - anyone above you in the tree, and Ops, read-only, once a review is submitted
  //  Nobody else. Colleagues at the same level, or in other teams, see nothing.
  function canView(r) {
    const v = state.viewAs;
    const e = r.employeeId;
    if (r.reviewerId === v) return true;
    if (e === v) return r.type === 'lead' && outcome(r.cycleId, e).discussed;
    if (isDirectLead(v, e)) return r.type === 'self' && isSubmitted(r) && isSubmitted(getReview(r.cycleId, e, 'lead'));
    if (canOversee(v, e)) return isSubmitted(r);
    return false;
  }
  function canCompare(c, e) {
    const v = state.viewAs;
    const both = isSubmitted(getReview(c, e, 'self')) && isSubmitted(getReview(c, e, 'lead'));
    if (e === v) return both && outcome(c, e).discussed;
    if (isDirectLead(v, e) || canOversee(v, e)) return both;
    return false;
  }
  // Only the direct team lead runs the review discussion and shares results
  const canLogDiscussion = (c, e) => isDirectLead(state.viewAs, e) && canCompare(c, e);
  // Why a read-only viewer can see this person
  function accessReason(e) {
    const v = state.viewAs;
    if (e === v || isDirectLead(v, e)) return '';
    if (isAbove(v, e)) return `${esc(person(e).name)} is in your wider team (reports to ${esc(person(person(e).leadId).name)}). You can read submitted reviews; only their team lead writes them and holds the review discussion.`;
    if (isOps(v)) return 'You can see this because you have Ops access. You can read submitted reviews; only the team lead writes them and holds the review discussion.';
    return '';
  }

  // ---------------------------------------------------------------- small UI pieces
  const lvlChip = (l) => (l === null || l === undefined ? '<span class="lvl lvl-none">Not rated</span>' : `<span class="lvl lvl-${l}">${LEVELS[l]}</span>`);
  const verdictHtml = (v) => (v ? `<span class="verdict ${v.replace(/ /g, '-')}">${v}</span>` : '<span class="muted">—</span>');
  function statusChip(r) {
    const s = r ? r.status : 'not_started';
    return { not_started: '<span class="chip">Not started</span>', draft: '<span class="chip amber">In progress</span>', submitted: '<span class="chip green">Submitted</span>' }[s];
  }
  function gapLabel(d) {
    if (d === null) return '<span class="gap gap-0">—</span>';
    if (d === 0) return '<span class="gap gap-0">Same</span>';
    const cls = Math.abs(d) >= 2 ? 'gap-2' : 'gap-1';
    const n = Math.abs(d);
    return `<span class="gap ${cls}">Team lead ${n} level${n > 1 ? 's' : ''} ${d > 0 ? 'higher' : 'lower'}</span>`;
  }
  const gapClass = (d) => (d === null || d === 0 ? '' : Math.abs(d) >= 2 ? 'gap-2' : 'gap-1');
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function talentBarLine(p) {
    const tb = FW.talentBar[p.seniority];
    return FW.areas.map((a) => `${a} ${lvlChip(tb[a])}`).join(' &nbsp; ');
  }
  function timeline(c, stageIdx) {
    return `<div class="timeline" style="grid-template-columns:repeat(${c.stages.length}, 1fr)">${c.stages.map((s, i) => `
      <div class="stage ${i < stageIdx ? 'done' : i === stageIdx ? 'current' : ''}">
        <div class="name">${esc(s.name)}</div>
        <div class="muted small">Due ${fmtDate(s.due)}</div>
      </div>`).join('')}</div>`;
  }
  function stageIndex(c, e) {
    if (!isSubmitted(getReview(c, e, 'self'))) return 0;
    if (!isSubmitted(getReview(c, e, 'lead'))) return 1;
    if (!outcome(c, e).discussed) return 2;
    return cycleById(c).stages.length;
  }

  // ---------------------------------------------------------------- top bar & nav
  // Outline line icons (1.75px stroke, rounded), as the design system asks
  const icon = (d) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const NAV_ICONS = {
    '': icon('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>'),
    team: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    goals: icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    'one-on-ones': icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    all: icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'),
    framework: icon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  };
  function renderTopbar() {
    const sel = $('#viewas');
    const opt = (p) => `<option value="${p.id}" ${p.id === state.viewAs ? 'selected' : ''}>${esc(p.name)} — ${esc(p.title)}</option>`;
    const teams = [...new Set(state.people.map((p) => p.team || 'Team'))];
    sel.innerHTML = teams.map((t) => `<optgroup label="${esc(t)}">${state.people.filter((p) => (p.team || 'Team') === t).map(opt).join('')}</optgroup>`).join('');
    $('#viewas-role').textContent = (isLead(state.viewAs) ? 'Team lead' : 'Team member') + (isOps(state.viewAs) ? ' · Ops access' : '');
    $('#viewas-role').className = 'chip ' + (isLead(state.viewAs) ? 'navy' : 'blue');
  }
  function renderNav(parts) {
    const p = me();
    const items = [];
    if (hasScorecard(p)) items.push(['', 'My review']);
    if (isLead(p.id)) items.push(['team', 'My team']);
    if (isOps(p.id)) items.push(['all', 'All reviews']);
    items.push(['goals', 'Goals']);
    items.push(['one-on-ones', '1:1 notes']);
    const top = parts[0] || '';
    const activeFor = (k) => {
      if (k === top) return true;
      if (k === '' && top === 'review') return getReviewFromHash()?.employeeId === state.viewAs;
      if (k === 'team' && (top === 'compare' || top === 'review')) return getReviewFromHash()?.employeeId !== state.viewAs && (top === 'review' || parts[2] !== state.viewAs);
      return false;
    };
    const link = (k, label, active) => `<a href="#/${k}" class="${active ? 'active' : ''}">${NAV_ICONS[k] || ''}<span>${label}</span></a>`;
    $('#sidenav').innerHTML =
      items.map(([k, label]) => link(k, label, activeFor(k))).join('') +
      `<div class="nav-label">Reference</div>` + link('framework', 'Scorecard & talent bar', top === 'framework');
  }
  function getReviewFromHash() {
    const parts = routeParts();
    if (parts[0] === 'review') return state.reviews.find((r) => r.id === parts[1]);
    return null;
  }

  // ---------------------------------------------------------------- views
  function viewHome() {
    const p = me();
    const c = openCycle();
    const self = getReview(c.id, p.id, 'self');
    const lead = getReview(c.id, p.id, 'lead');
    const o = outcome(c.id, p.id);
    const tl = person(p.leadId);
    const idx = stageIndex(c.id, p.id);

    const selfBtn = !self || self.status === 'not_started'
      ? `<button class="btn primary" data-action="open-review" data-c="${c.id}" data-e="${p.id}" data-t="self">Start self-review</button>`
      : self.status === 'draft'
        ? `<button class="btn primary" data-action="open-review" data-c="${c.id}" data-e="${p.id}" data-t="self">Continue self-review</button>`
        : `<a class="btn" href="#/review/${self.id}">View my self-review</a>`;
    const selfScore = self ? scoreReview(p, self.answers) : null;

    let results;
    if (o.discussed && lead) {
      const s = scoreReview(p, lead.answers);
      results = `
        <div class="spread"><h2>Your results</h2><span class="chip green">Discussed with ${esc(firstName(tl))}${o.date ? ' on ' + fmtDate(o.date) : ''}</span></div>
        <table>
          <tr><th>Area</th><th>Talent bar for ${esc(p.seniority)}</th><th>Team lead's grade</th><th>Result</th></tr>
          ${FW.areas.map((a) => `<tr><td>${a}</td><td>${lvlChip(s.areas[a].bar)}</td><td>${lvlChip(s.areas[a].level)}</td><td>${verdictHtml(s.areas[a].verdict)}</td></tr>`).join('')}
          <tr><td><b>Overall</b></td><td></td><td></td><td>${verdictHtml(s.overall)}</td></tr>
        </table>
        <div class="side-by-side" style="margin-top:14px">
          <div class="col"><h4>Strengths</h4>${listHtml(lead.strengths)}</div>
          <div class="col"><h4>Improvement areas</h4>${listHtml(lead.improvements)}</div>
        </div>
        ${discussionRecord(o)}
        <div style="margin-top:14px"><a class="btn primary" href="#/compare/${c.id}/${p.id}">Compare with my self-review</a></div>`;
    } else {
      results = `<h2>Your results</h2><p class="muted">Your results appear here after your review discussion with ${esc(tl ? tl.name : 'your team lead')}, along with the notes and transcript from the meeting.</p>`;
    }

    const past = state.cycles.filter((cy) => cy.status === 'closed').map((cy) => {
      const lr = getReview(cy.id, p.id, 'lead');
      if (!lr || !outcome(cy.id, p.id).discussed) return '';
      const s = scoreReview(p, lr.answers);
      return `<tr class="clickable" data-href="#/compare/${cy.id}/${p.id}"><td>${esc(cy.name)}</td>
        ${FW.areas.map((a) => `<td>${lvlChip(s.areas[a].level)}</td>`).join('')}<td>${verdictHtml(s.overall)}</td><td><span class="btn small">View</span></td></tr>`;
    }).join('');

    return `
      <div class="page-head">
        <h1>Hi ${esc(firstName(p))}</h1>
        <div class="muted">${esc(p.title)} · ${esc(p.seniority)} · ${esc(FW.roles[p.role].name)} scorecard · Team lead: ${esc(tl ? tl.name : '—')}</div>
      </div>
      <div class="card">
        <div class="spread"><h2 style="margin:0">${esc(c.name)} review cycle</h2><span class="chip blue">In progress</span></div>
        ${timeline(c, idx)}
      </div>
      <div class="grid2">
        <div class="card">
          <div class="spread"><h2>Self-review</h2>${statusChip(self)}</div>
          <p class="muted" style="margin-top:0">Rate yourself against the Neutreeno scorecard: Culture, Deliverables and your ${esc(FW.roles[p.role].name)} skills. Due ${fmtDate(c.stages[0].due)}.</p>
          ${selfScore && selfScore.answered ? `<div class="row small muted" style="margin-bottom:10px"><div class="progress" style="flex:1"><div style="width:${Math.round(100 * selfScore.answered / selfScore.total)}%"></div></div>${selfScore.answered}/${selfScore.total} lines</div>` : ''}
          ${selfBtn}
        </div>
        <div class="card">
          <h2>Your talent bar</h2>
          <p class="muted" style="margin-top:0">What's expected at ${esc(p.seniority)} level. Meeting it means you're <b>Above the Bar</b>; beating it makes you an <b>A-player</b> in that area.</p>
          <div>${talentBarLine(p)}</div>
          <div style="margin-top:12px"><a href="#/framework">See the full scorecard and talent bar →</a></div>
        </div>
      </div>
      <div class="card">${results}</div>
      ${past ? `<div class="card"><h2>Past reviews</h2><table><tr><th>Cycle</th>${FW.areas.map((a) => `<th>${a}</th>`).join('')}<th>Overall</th><th></th></tr>${past}</table></div>` : ''}`;
  }
  // Notes and transcript from a review discussion, for looking back on later
  function discussionRecord(o) {
    const notes = o.notes ? `<div style="margin-top:14px"><h4 class="muted small" style="margin:0 0 4px">Notes from the review discussion</h4>${esc(o.notes)}</div>` : '';
    const tr = o.transcript ? `<details style="margin-top:10px"><summary>Read the meeting transcript</summary><div class="trait-desc" style="white-space:pre-wrap">${esc(o.transcript)}</div></details>` : '';
    return notes + tr;
  }
  const listHtml = (arr) => {
    const items = (arr || []).filter((x) => x && x.trim());
    return items.length ? `<ul class="plain">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span class="muted">—</span>';
  };

  // Rows for people you only read (wider team, or everyone for Ops)
  function readOnlyRow(rp, c) {
    const tl = person(rp.leadId);
    const who = `<td><b>${esc(rp.name)}</b><div class="muted small">${esc(rp.title)}${esc(seniorityText(rp))}</div></td><td class="small">${esc(tl ? tl.name : '—')}</td>`;
    if (!hasScorecard(rp)) return `<tr>${who}<td colspan="4" class="muted small">No scorecard for this role yet</td></tr>`;
    const self = getReview(c.id, rp.id, 'self');
    const lead = getReview(c.id, rp.id, 'lead');
    const o = outcome(c.id, rp.id);
    const ls = isSubmitted(lead) && canView(lead) ? scoreReview(rp, lead.answers) : null;
    const links = [
      self && canView(self) ? `<a class="btn small" href="#/review/${self.id}">Self-review</a>` : '',
      lead && canView(lead) ? `<a class="btn small" href="#/review/${lead.id}">Team lead review</a>` : '',
      canCompare(c.id, rp.id) ? `<a class="btn small" href="#/compare/${c.id}/${rp.id}">Side by side</a>` : '',
    ].join('');
    return `<tr>${who}
      <td>${statusChip(self)}</td>
      <td>${statusChip(lead)}${o.discussed ? ' <span class="chip green">Discussed</span>' : ''}</td>
      <td>${ls && ls.complete ? verdictHtml(ls.overall) : '<span class="muted">—</span>'}</td>
      <td><div class="row">${links || '<span class="muted small">Nothing submitted yet</span>'}</div></td>
    </tr>`;
  }
  const readOnlyHead = '<tr><th>Person</th><th>Team lead</th><th>Self-review</th><th>Team lead review</th><th>Overall</th><th></th></tr>';
  const openRolesUnder = (ids) => (state.openRoles || []).filter((r) => ids.includes(r.leadId));
  function openRolesCard(roles) {
    if (!roles.length) return '';
    return `<div class="card"><h2>Open roles</h2>
      <table><tr><th>Role</th><th>Will report to</th></tr>
      ${roles.map((r) => `<tr><td>${esc(r.title)} <span class="chip amber">Hiring</span></td><td>${esc(person(r.leadId).name)}</td></tr>`).join('')}</table>
      <p class="muted small" style="margin-bottom:0">New starters get a scorecard from their first full review cycle.</p></div>`;
  }

  function viewTeam() {
    const v = me();
    const c = openCycle();
    const reps = reportsOf(v.id);
    const wider = below(v.id).filter((p) => p.leadId !== v.id);
    const rows = reps.map((rp) => {
      const who = `<td><b>${esc(rp.name)}</b><div class="muted small">${esc(rp.title)}${esc(seniorityText(rp))}</div></td>`;
      if (!hasScorecard(rp)) return `<tr>${who}<td colspan="5" class="muted small">No scorecard for this role yet</td></tr>`;
      const self = getReview(c.id, rp.id, 'self');
      const lead = getReview(c.id, rp.id, 'lead');
      const o = outcome(c.id, rp.id);
      const ls = lead && lead.status !== 'not_started' ? scoreReview(rp, lead.answers) : null;
      let diffs = '';
      if (isSubmitted(self) && isSubmitted(lead)) {
        const d = countDiffs(rp, self, lead);
        diffs = d.diff ? `<span class="chip ${d.big ? 'red' : 'amber'}">${d.diff} differ${d.big ? ` · ${d.big} by 2+` : ''}</span>` : '<span class="chip green">All agree</span>';
      }
      const leadLabel = !lead || lead.status === 'not_started' ? 'Start review' : lead.status === 'draft' ? 'Continue review' : 'View review';
      const selfNote = isSubmitted(self) && !isSubmitted(lead) ? '<div class="muted small">Visible after you submit yours</div>' : '';
      return `<tr>${who}
        <td>${statusChip(self)}${selfNote}</td>
        <td>${statusChip(lead)}</td>
        <td>${ls && ls.complete ? verdictHtml(ls.overall) : '<span class="muted">—</span>'}</td>
        <td>${diffs || '<span class="muted">—</span>'}</td>
        <td><div class="row">
          <button class="btn small ${!isSubmitted(lead) ? 'primary' : ''}" data-action="open-review" data-c="${c.id}" data-e="${rp.id}" data-t="lead">${leadLabel}</button>
          ${canCompare(c.id, rp.id) ? `<a class="btn small ${!o.discussed ? 'primary' : ''}" href="#/compare/${c.id}/${rp.id}">Side by side</a>` : ''}
          ${o.discussed ? '<span class="chip green">Discussed</span>' : ''}
        </div></td>
      </tr>`;
    }).join('');
    const widerCard = wider.length ? `
      <div class="card" style="padding:6px 10px">
        <div style="padding:14px 10px 4px"><h2 style="margin:0">Wider team</h2>
          <p class="muted small" style="margin:4px 0 0">People who report to your direct reports. You can read their reviews once they're submitted; their own team lead writes them and holds the discussion.</p></div>
        <table>${readOnlyHead}${wider.map((rp) => readOnlyRow(rp, c)).join('')}</table>
      </div>` : '';
    return `
      <div class="page-head"><h1>My team</h1><div class="muted">${esc(c.name)} review cycle · ${reps.length} direct report${reps.length === 1 ? '' : 's'}${wider.length ? ` · ${wider.length} more in your wider team` : ''}</div></div>
      <div class="notice">How it works: each person fills in their self-review while you fill in your team lead review. Both are due on the same day. Once you've both submitted, open <b>Side by side</b> to see where you disagree and use it as the agenda for your review discussion. Afterwards, log the discussion with the meeting transcript so you can both look back at it.</div>
      <div class="card" style="padding:6px 10px">
        <div style="padding:14px 10px 4px"><h2 style="margin:0">Direct reports</h2></div>
        <table>
          <tr><th>Person</th><th>Self-review</th><th>Your review</th><th>Overall (your review)</th><th>Differences</th><th></th></tr>
          ${rows || '<tr><td colspan="6" class="empty-state">No one reports to you.</td></tr>'}
        </table>
      </div>
      ${widerCard}
      ${openRolesCard(openRolesUnder([v.id, ...below(v.id).map((p) => p.id)]))}
      <div class="card"><h2>${esc(c.name)} timeline</h2>${timeline(c, -1)}</div>`;
  }

  // Ops access: every review in the company, read-only
  function viewAll() {
    const c = openCycle();
    const v = me();
    const everyone = state.people.filter((p) => p.id !== v.id && p.leadId);
    const scored = everyone.filter(hasScorecard);
    const count = (fn) => scored.filter(fn).length;
    const selfDone = count((p) => isSubmitted(getReview(c.id, p.id, 'self')));
    const leadDone = count((p) => isSubmitted(getReview(c.id, p.id, 'lead')));
    const discussed = count((p) => outcome(c.id, p.id).discussed);
    const teams = [...new Set(everyone.map((p) => p.team || 'Team'))];
    return `
      <div class="page-head"><h1>All reviews</h1><div class="muted">${esc(c.name)} review cycle · everyone except you · read-only</div></div>
      <div class="notice">You have Ops access, so you can read every submitted review to run the cycle. Only each person's team lead writes their team lead review and holds the review discussion.</div>
      <div class="grid3">
        <div class="card"><div class="muted small">Self-reviews submitted</div><div style="font-size:32px;color:var(--link)">${selfDone}<span class="muted" style="font-size:16px"> / ${scored.length}</span></div></div>
        <div class="card"><div class="muted small">Team lead reviews submitted</div><div style="font-size:32px;color:var(--link)">${leadDone}<span class="muted" style="font-size:16px"> / ${scored.length}</span></div></div>
        <div class="card"><div class="muted small">Review discussions held</div><div style="font-size:32px;color:var(--link)">${discussed}<span class="muted" style="font-size:16px"> / ${scored.length}</span></div></div>
      </div>
      ${teams.map((t) => `<div class="card" style="padding:6px 10px">
        <div style="padding:14px 10px 4px"><h2 style="margin:0">${esc(t)}</h2></div>
        <table>${readOnlyHead}${everyone.filter((p) => (p.team || 'Team') === t).map((p) => readOnlyRow(p, c)).join('')}</table></div>`).join('')}
      ${openRolesCard(state.openRoles || [])}`;
  }

  function viewNoScorecard() {
    const p = me();
    const tl = person(p.leadId);
    return `
      <div class="page-head"><h1>Hi ${esc(firstName(p))}</h1><div class="muted">${esc(p.title)}${tl ? ' · Team lead: ' + esc(tl.name) : ''}</div></div>
      <div class="card"><h2>No scorecard for your role yet</h2>
        <p style="margin:0">Scorecards exist for Operations, Software and Carbon roles so far. Yours will appear here once it's added. In the meantime you can use Goals and 1:1 notes.</p></div>`;
  }
  function countDiffs(p, self, lead) {
    let diff = 0, big = 0, total = 0;
    for (const s of sectionsFor(p)) for (const t of s.traits) {
      const k = s.id + '::' + t.id;
      const a = self.answers[k], b = lead.answers[k];
      total++;
      if (a == null || b == null) continue;
      if (a !== b) diff++;
      if (Math.abs(a - b) >= 2) big++;
    }
    return { diff, big, total };
  }

  function viewReview(id) {
    const r = state.reviews.find((x) => x.id === id);
    if (!r) return notFound();
    if (!canView(r)) {
      const v = state.viewAs, e = r.employeeId;
      const related = e === v || isDirectLead(v, e) || canOversee(v, e);
      return `<div class="card empty-state">${related ? "You can't see this review yet." : `You can't see ${esc(person(e).name)}'s reviews.`}</div>`;
    }
    const p = person(r.employeeId);
    const c = cycleById(r.cycleId);
    const editable = canEdit(r);
    const sc = scoreReview(p, r.answers);
    const mine = r.employeeId === state.viewAs;
    const title = r.type === 'self' ? (mine ? 'My self-review' : `${p.name}'s self-review`) : (mine ? 'Team lead review' : `Team lead review: ${p.name}`);
    const subject = mine ? 'you' : firstName(p);

    let intro = accessReason(r.employeeId) ? `<div class="notice">${accessReason(r.employeeId)}</div>` : '';
    if (editable) {
      intro = `<div class="notice">For each line, pick the level that best describes ${esc(subject)} over the last six months. A section's grade is the average of its lines, rounded to the nearest level. Answers save automatically.
        ${r.type === 'lead' ? `<br>You'll see ${esc(firstName(p))}'s self-review side by side once you submit this.` : ''}</div>`;
    }

    const body = FW.areas.map((area) => {
      const a = sc.areas[area];
      const scope = area === 'Skills' ? `${FW.roles[p.role].name} skills` : 'Company-wide';
      return `<div class="area-title">${area} <span class="chip">${scope}</span> <span class="chip">Talent bar: ${LEVELS[a.bar]}</span></div>` +
        a.sections.map((s) => sectionCard(r, s, editable)).join('');
    }).join('');

    const extras = `
      <div class="area-title">Feedback</div>
      <div class="card">
        <div class="grid2">
          <div><h3>Strengths</h3>${[0, 1, 2].map((i) => `<div class="field"><input type="text" placeholder="${i + 1}." value="${esc(r.strengths[i])}" data-bind="strength" data-review="${r.id}" data-i="${i}" ${editable ? '' : 'disabled'}></div>`).join('')}</div>
          <div><h3>Improvement areas</h3>${[0, 1, 2].map((i) => `<div class="field"><input type="text" placeholder="${i + 1}." value="${esc(r.improvements[i])}" data-bind="improvement" data-review="${r.id}" data-i="${i}" ${editable ? '' : 'disabled'}></div>`).join('')}</div>
        </div>
      </div>
      ${r.type === 'lead' ? kpiCard(r, editable) : ''}`;

    const summary = `
      <div class="card summary">
        <h3>Summary</h3>
        <table>
          <tr><th>Area</th><th>Grade</th><th>Bar</th><th>Result</th></tr>
          ${FW.areas.map((a) => `<tr><td>${a}</td><td>${lvlChip(sc.areas[a].level)}</td><td>${LEVELS[sc.areas[a].bar]}</td><td class="small">${verdictHtml(sc.areas[a].verdict)}</td></tr>`).join('')}
          <tr><td><b>Overall</b></td><td colspan="3">${verdictHtml(sc.overall)}</td></tr>
        </table>
        <div class="row small muted" style="margin:12px 0"><div class="progress" style="flex:1"><div style="width:${Math.round(100 * sc.answered / sc.total)}%"></div></div>${sc.answered}/${sc.total}</div>
        ${editable ? `
          <div class="row"><button class="btn" data-action="save-draft">Save draft</button><button class="btn primary" data-action="submit-review" data-review="${r.id}">Submit</button></div>
          <p class="muted small" style="margin-bottom:0">Results: below the talent bar = Underperformer, at it = Above the Bar, above it = A-player. Overall is Underperformer if any area is below the bar, A-player if two or more areas are above it.</p>`
        : `<div>${statusChip(r)} ${r.submittedAt ? `<span class="muted small">on ${fmtDate(r.submittedAt)}</span>` : ''}</div>
           ${canCompare(r.cycleId, r.employeeId) ? `<div style="margin-top:10px"><a class="btn primary" href="#/compare/${r.cycleId}/${r.employeeId}">See side by side</a></div>` : ''}`}
      </div>`;

    return `
      <div class="page-head">
        <h1>${esc(title)}</h1>
        <div class="muted">${esc(c.name)} · ${esc(p.name)} · ${esc(p.title)} · ${esc(p.seniority)}</div>
      </div>
      ${intro}
      <div class="scorecard"><div>${body}${extras}</div>${summary}</div>`;
  }

  function sectionCard(r, s, editable) {
    const sec = s.sec;
    const scoreLine = s.level === null
      ? '<span class="muted small">Not started</span>'
      : `${lvlChip(s.level)} <span class="muted small">average ${s.avg.toFixed(1)} · ${s.answered}/${s.total} answered</span>`;
    return `<div class="card">
      <div class="section-head"><h3 style="margin:0">${esc(sec.name)}</h3><div class="row">${scoreLine}</div></div>
      ${sec.traits.map((t) => traitHtml(r, sec, t, editable)).join('')}
      <div style="margin-top:10px">
        <textarea placeholder="Examples and justification (optional)" data-bind="comment" data-review="${r.id}" data-key="${sec.id}" ${editable ? '' : 'disabled'}>${esc(r.comments[sec.id] || '')}</textarea>
      </div>
    </div>`;
  }

  function traitHtml(r, sec, t, editable) {
    const k = sec.id + '::' + t.id;
    const v = r.answers[k];
    const single = sec.traits.length === 1;
    const pills = LEVELS.map((L, i) => `<button class="pill ${v === i ? 'selected' : ''}" data-action="pick" data-review="${r.id}" data-key="${k}" data-level="${i}" ${editable ? '' : 'disabled'}>${L}</button>`).join('');
    const desc = v !== undefined && v !== null
      ? `<div class="trait-desc"><b>${LEVELS[v]}:</b> ${esc(t.levels[v])}</div>`
      : `<div class="trait-desc empty">${editable ? 'Pick a level — or open “See all levels” to compare them.' : 'Not answered.'}</div>`;
    return `<div class="trait">
      <div class="trait-head"><span class="trait-name">${single ? '<span class="muted">Rating</span>' : esc(t.name)}</span><div class="pills">${pills}</div></div>
      ${desc}
      <details><summary>See all levels</summary><ul class="levels-list">${t.levels.map((txt, i) => `<li>${lvlChip(i)}<span>${esc(txt)}</span></li>`).join('')}</ul></details>
    </div>`;
  }

  function kpiCard(r, editable) {
    const rows = r.kpis.map((k, i) => `<tr>
      <td><input type="text" value="${esc(k.text)}" placeholder="KPI" data-bind="kpi" data-field="text" data-review="${r.id}" data-i="${i}" ${editable ? '' : 'disabled'}></td>
      <td style="width:130px"><select data-bind="kpi" data-field="achieved" data-review="${r.id}" data-i="${i}" ${editable ? '' : 'disabled'}>
        ${['', 'Yes', 'Partly', 'No'].map((o) => `<option ${k.achieved === o ? 'selected' : ''} value="${o}">${o || 'Achieved?'}</option>`).join('')}</select></td>
      <td><input type="text" value="${esc(k.link)}" placeholder="Link (optional)" data-bind="kpi" data-field="link" data-review="${r.id}" data-i="${i}" ${editable ? '' : 'disabled'}></td>
      <td style="width:40px">${editable ? `<button class="link" data-action="remove-kpi" data-review="${r.id}" data-i="${i}">Remove</button>` : ''}</td>
    </tr>`).join('');
    return `<div class="card"><h3>KPIs</h3>
      <table><tr><th>KPI</th><th>Achieved?</th><th>Link</th><th></th></tr>${rows || '<tr><td colspan="4" class="muted">No KPIs added.</td></tr>'}</table>
      ${editable ? `<div style="margin-top:10px"><button class="btn small" data-action="add-kpi" data-review="${r.id}">+ Add KPI</button></div>` : ''}
    </div>`;
  }

  function viewCompare(c, e) {
    const p = person(e);
    if (!p || !cycleById(c)) return notFound();
    const related = e === state.viewAs || isDirectLead(state.viewAs, e) || canOversee(state.viewAs, e);
    if (!related) return `<div class="card empty-state">You can't see ${esc(p.name)}'s reviews.</div>`;
    if (!canCompare(c, e)) return `<div class="card empty-state">The side-by-side view opens once both reviews are submitted${e === state.viewAs ? ' and you\'ve had your review discussion' : ''}.</div>`;
    const self = getReview(c, e, 'self');
    const lead = getReview(c, e, 'lead');
    const ss = scoreReview(p, self.answers);
    const ls = scoreReview(p, lead.answers);
    const o = outcome(c, e);
    const tl = person(p.leadId);
    const viewerIsLead = canLogDiscussion(c, e);
    const cyc = cycleById(c);
    const d = countDiffs(p, self, lead);
    const selfLabel = e === state.viewAs ? 'You' : firstName(p);

    const summary = `
      <table>
        <tr><th>Area</th><th>Talent bar</th><th>Self-review (${esc(selfLabel)})</th><th>Team lead (${esc(firstName(tl))})</th><th>Difference</th></tr>
        ${FW.areas.map((a) => {
          const gap = ls.areas[a].level - ss.areas[a].level;
          return `<tr class="cmp-row ${gapClass(gap)}"><td><b>${a}</b></td><td>${lvlChip(ss.areas[a].bar)}</td>
            <td>${lvlChip(ss.areas[a].level)} <span class="small">${verdictHtml(ss.areas[a].verdict)}</span></td>
            <td>${lvlChip(ls.areas[a].level)} <span class="small">${verdictHtml(ls.areas[a].verdict)}</span></td>
            <td>${gapLabel(gap)}</td></tr>`;
        }).join('')}
        <tr class="cmp-row ${ss.overall !== ls.overall ? 'gap-1' : ''}"><td><b>Overall</b></td><td></td><td>${verdictHtml(ss.overall)}</td><td>${verdictHtml(ls.overall)}</td><td>${ss.overall === ls.overall ? '<span class="gap gap-0">Same</span>' : '<span class="gap gap-1">Different</span>'}</td></tr>
      </table>`;

    const sections = FW.areas.map((area) => {
      const secs = sectionsFor(p).filter((s) => s.area === area);
      return `<div class="area-title">${area}</div>` + secs.map((sec) => {
        const sS = sectionScore(sec, self.answers);
        const lS = sectionScore(sec, lead.answers);
        const rows = sec.traits.map((t) => {
          const k = sec.id + '::' + t.id;
          const a = self.answers[k], b = lead.answers[k];
          const gap = a == null || b == null ? null : b - a;
          if (ui.onlyDiffs && !gap) return '';
          const name = sec.traits.length === 1 ? sec.name : t.name;
          return `<tr class="cmp-row ${gapClass(gap)}">
            <td><b>${esc(name)}</b>
              <details><summary>What these levels mean</summary><div class="cmp-detail">
                ${a != null ? `<p><b>${esc(selfLabel)} — ${LEVELS[a]}:</b> ${esc(t.levels[a])}</p>` : ''}
                ${b != null && b !== a ? `<p><b>${esc(firstName(tl))} — ${LEVELS[b]}:</b> ${esc(t.levels[b])}</p>` : ''}
              </div></details></td>
            <td>${lvlChip(a)}</td><td>${lvlChip(b)}</td><td>${gapLabel(gap)}</td></tr>`;
        }).join('');
        if (ui.onlyDiffs && !rows) return '';
        const sc = self.comments[sec.id], lc = lead.comments[sec.id];
        return `<div class="card">
          <div class="section-head"><h3 style="margin:0">${esc(sec.name)}</h3>
            <div class="row small">${esc(selfLabel)} ${lvlChip(sS.level)} · ${esc(firstName(tl))} ${lvlChip(lS.level)}</div></div>
          <table><tr><th>Line</th><th style="width:130px">Self-review</th><th style="width:130px">Team lead</th><th style="width:190px">Difference</th></tr>${rows}</table>
          ${sc || lc ? `<div class="side-by-side" style="margin-top:12px">
            <div class="col"><h4>${esc(selfLabel)}'s comments</h4>${sc ? esc(sc) : '<span class="muted">—</span>'}</div>
            <div class="col"><h4>${esc(firstName(tl))}'s comments</h4>${lc ? esc(lc) : '<span class="muted">—</span>'}</div></div>` : ''}
        </div>`;
      }).join('');
    }).join('');

    const feedback = `
      <div class="area-title">Feedback</div>
      <div class="card"><div class="side-by-side">
        <div class="col"><h4>Strengths — ${esc(selfLabel)}</h4>${listHtml(self.strengths)}<h4 style="margin-top:14px">Improvement areas — ${esc(selfLabel)}</h4>${listHtml(self.improvements)}</div>
        <div class="col"><h4>Strengths — ${esc(firstName(tl))}</h4>${listHtml(lead.strengths)}<h4 style="margin-top:14px">Improvement areas — ${esc(firstName(tl))}</h4>${listHtml(lead.improvements)}</div>
      </div></div>
      ${lead.kpis.length ? `<div class="card"><h3>KPIs</h3><table><tr><th>KPI</th><th>Achieved?</th></tr>${lead.kpis.map((k) => `<tr><td>${esc(k.text)}</td><td>${k.achieved ? `<span class="chip ${k.achieved === 'Yes' ? 'green' : k.achieved === 'No' ? 'red' : 'amber'}">${esc(k.achieved)}</span>` : '—'}</td></tr>`).join('')}</table></div>` : ''}`;

    const discussion = viewerIsLead
      ? `<div class="card"><div class="spread"><h3 style="margin:0">Review discussion</h3>${o.discussed ? `<span class="chip green">Held${o.date ? ' on ' + fmtDate(o.date) : ''}</span>` : `<span class="chip">Due ${fmtDate(cyc.stages[cyc.stages.length - 1].due)}</span>`}</div>
          <p class="muted small">Use the highlighted lines as your agenda. Once you've met, add the transcript and mark it as held. ${esc(firstName(p))} can then see their results and look back over the meeting.</p>
          <div class="form-grid" style="grid-template-columns:200px 1fr"><div><label>Meeting date</label><input type="date" value="${esc(o.date)}" data-bind="discussion" data-field="date" data-c="${c}" data-e="${e}"></div></div>
          <div class="field" style="margin-top:10px"><label>Notes: what you agreed</label><textarea data-bind="discussion" data-field="notes" data-c="${c}" data-e="${e}" placeholder="What did you agree on?">${esc(o.notes)}</textarea></div>
          <div class="field"><label>Transcript (paste from Google Meet, Teams or your notes)</label><textarea style="min-height:120px" data-bind="discussion" data-field="transcript" data-c="${c}" data-e="${e}" placeholder="Paste the meeting transcript here">${esc(o.transcript)}</textarea></div>
          <div class="row">${o.discussed
            ? `<span class="muted small">Changes save automatically.</span> <button class="link small" data-action="reopen-discussion" data-c="${c}" data-e="${e}">Mark as not held yet</button>`
            : `<button class="btn primary" data-action="hold-discussion" data-c="${c}" data-e="${e}">Mark discussion as held</button>`}</div></div>`
      : (o.discussed ? `<div class="card"><h3>Review discussion${o.date ? ' · ' + fmtDate(o.date) : ''}</h3>${discussionRecord(o)}</div>` : '');

    return `
      <div class="page-head spread">
        <div><h1>${esc(p.name)}: side by side</h1>
          <div class="muted">${esc(cyc.name)} · ${esc(p.title)} · ${esc(p.seniority)} · Team lead: ${esc(tl.name)}</div></div>
        ${o.discussed ? `<span class="chip green">Discussed${o.date ? ' ' + fmtDate(o.date) : ''}</span>` : '<span class="chip">Discussion not held yet</span>'}
      </div>
      ${accessReason(e) ? `<div class="notice">${accessReason(e)}</div>` : ''}
      <div class="card">${summary}</div>
      <div class="card spread">
        <div><b>${d.diff} of ${d.total}</b> lines rated differently${d.big ? ` · <b style="color:var(--red-text)">${d.big}</b> by two or more levels` : ''}
          <div class="legend" style="margin-top:6px"><span><span class="swatch" style="background:var(--amber-bg);border:1px solid var(--amber-line)"></span>1 level apart</span><span><span class="swatch" style="background:var(--red-bg);border:1px solid var(--red-line)"></span>2+ levels apart</span></div></div>
        <label class="row"><input type="checkbox" data-action="toggle-diffs" ${ui.onlyDiffs ? 'checked' : ''}> Only show lines that differ</label>
      </div>
      ${discussion}
      ${sections}
      ${feedback}`;
  }

  function viewGoals() {
    const v = me();
    const reps = reportsOf(v.id).map((p) => p.id);
    if (!ui.goalFilter) ui.goalFilter = isLead(v.id) ? 'team' : 'mine';
    const filters = [['mine', 'Mine'], ...(isLead(v.id) ? [['team', 'My team']] : []), ['company', 'Company'], ['all', 'All']];
    const goals = state.goals.filter((g) => {
      if (ui.goalFilter === 'mine') return g.ownerId === v.id;
      if (ui.goalFilter === 'team') return g.ownerId === v.id || reps.includes(g.ownerId);
      if (ui.goalFilter === 'company') return g.level === 'Company';
      return true;
    });
    const canUpdate = (g) => g.ownerId === v.id || reps.includes(g.ownerId);
    const rows = goals.map((g) => {
      const pct = goalPct(g);
      const st = pct >= 100 ? ['green', 'Achieved'] : pct >= 60 ? ['blue', 'On track'] : pct >= 30 ? ['amber', 'At risk'] : ['red', 'Off track'];
      const owner = person(g.ownerId);
      const u = esc(g.unit);
      return `<tr>
        <td><b>${esc(g.title)}</b></td>
        <td><span class="chip">${esc(g.level)}</span></td>
        <td>${esc(owner ? owner.name : '')}</td>
        <td style="width:170px"><div class="row small"><div class="progress" style="flex:1"><div style="width:${pct}%"></div></div>${pct}%</div></td>
        <td class="small" style="white-space:nowrap">${g.start}${u} → ${canUpdate(g) ? `<input type="number" step="any" style="width:80px" value="${g.current}" data-bind="goal-current" data-id="${g.id}">` : `<b>${g.current}</b>`}${u} → ${g.target}${u}</td>
        <td class="small">${fmtDate(g.due)}</td>
        <td><span class="chip ${st[0]}">${st[1]}</span></td>
        <td>${g.ownerId === v.id ? `<button class="link small" data-action="delete-goal" data-id="${g.id}">Delete</button>` : ''}</td>
      </tr>`;
    }).join('');
    const owners = [v, ...reportsOf(v.id)];
    const form = ui.showGoalForm ? `
      <div class="card"><h3>New goal</h3>
        <div class="field"><label>Goal</label><input type="text" id="g-title" placeholder="e.g. Monthly close within 5 working days"></div>
        <div class="form-grid">
          <div><label>Level</label><select id="g-level"><option>Personal</option><option>Team</option><option>Company</option></select></div>
          <div><label>Owner</label><select id="g-owner">${owners.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>
          <div><label>Due</label><input type="date" id="g-due"></div>
          <div><label>Unit (optional)</label><input type="text" id="g-unit" placeholder="%, £k, days…"></div>
          <div><label>Start value</label><input type="number" step="any" id="g-start" value="0"></div>
          <div><label>Current value</label><input type="number" step="any" id="g-current" value="0"></div>
          <div><label>Target value</label><input type="number" step="any" id="g-target" value="100"></div>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-action="add-goal">Add goal</button><button class="btn" data-action="toggle-goal-form">Cancel</button></div>
      </div>` : '';
    return `
      <div class="page-head spread"><div><h1>Goals</h1><div class="muted">Company, team and personal goals. Update the current value as things move.</div></div>
        ${ui.showGoalForm ? '' : '<button class="btn primary" data-action="toggle-goal-form">+ New goal</button>'}</div>
      ${form}
      <div class="row" style="margin-bottom:12px">${filters.map(([k, l]) => `<button class="btn small ${ui.goalFilter === k ? 'primary' : ''}" data-action="goal-filter" data-f="${k}">${l}</button>`).join('')}</div>
      <div class="card" style="padding:6px 10px"><table>
        <tr><th>Goal</th><th>Level</th><th>Owner</th><th>Progress</th><th>Start → Current → Target</th><th>Due</th><th>Status</th><th></th></tr>
        ${rows || '<tr><td colspan="8" class="empty-state">No goals here yet.</td></tr>'}
      </table></div>`;
  }
  function goalPct(g) {
    const span = g.target - g.start;
    if (!span) return g.current === g.target ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round(((g.current - g.start) / span) * 100)));
  }

  // ---- 1:1 notes
  function meetingPartners(v) {
    const list = reportsOf(v.id);
    if (v.leadId) list.push(person(v.leadId));
    return list;
  }
  function viewMeetings() {
    const v = me();
    const list = state.oneOnOnes.filter((m) => m.leadId === v.id || m.employeeId === v.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    const rows = list.map((m) => {
      const other = person(m.leadId === v.id ? m.employeeId : m.leadId);
      return `<tr class="clickable" data-href="#/one-on-ones/${m.id}">
        <td style="white-space:nowrap">${fmtDate(m.date)}</td><td>${esc(other.name)}</td>
        <td class="small">${esc((m.summary || '').slice(0, 140))}${(m.summary || '').length > 140 ? '…' : ''}</td>
        <td><span class="chip">${m.actions.length} action${m.actions.length === 1 ? '' : 's'}</span></td></tr>`;
    }).join('');
    return `
      <div class="page-head spread"><div><h1>1:1 notes</h1><div class="muted">Regular check-ins with your team lead. These don't use the scorecard.</div></div>
        <a class="btn primary" href="#/one-on-ones/new">+ New 1:1 notes</a></div>
      <div class="card" style="padding:6px 10px"><table>
        <tr><th>Date</th><th>With</th><th>Summary</th><th>Actions</th></tr>
        ${rows || '<tr><td colspan="4" class="empty-state">No 1:1 notes yet.</td></tr>'}
      </table></div>`;
  }
  function viewMeeting(id) {
    const v = me();
    let m;
    if (id === 'new') {
      const partners = meetingPartners(v);
      if (!partners.length) return '<div class="card empty-state">You have no team lead or team members to meet with.</div>';
      if (!ui.meetingDraft || ui.meetingDraft.owner !== v.id) {
        ui.meetingDraft = { id: null, owner: v.id, otherId: partners[0].id, date: today(), transcript: '', summary: '', actions: [], wins: [], concerns: [] };
      }
      m = ui.meetingDraft;
    } else {
      const found = state.oneOnOnes.find((x) => x.id === id);
      if (!found || (found.leadId !== v.id && found.employeeId !== v.id)) return notFound();
      m = found;
    }
    const isNew = id === 'new';
    const other = isNew ? null : person(m.leadId === v.id ? m.employeeId : m.leadId);
    const bindAttr = `data-meeting="${isNew ? 'new' : m.id}"`;
    return `
      <div class="page-head"><a href="#/one-on-ones" class="small">← All 1:1 notes</a>
        <h1>${isNew ? 'New 1:1 notes' : `1:1 with ${esc(other.name)}`}</h1></div>
      <div class="grid2">
        <div class="card">
          <h3>Meeting</h3>
          <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div><label>With</label>${isNew
              ? `<select data-bind="meeting" data-field="otherId" ${bindAttr}>${meetingPartners(v).map((p) => `<option value="${p.id}" ${p.id === m.otherId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`
              : `<input type="text" value="${esc(other.name)}" disabled>`}</div>
            <div><label>Date</label><input type="date" value="${m.date}" data-bind="meeting" data-field="date" ${bindAttr}></div>
          </div>
          <div class="field" style="margin-top:12px"><label>Transcript (paste from Google Meet, Teams or your notes)</label>
            <textarea style="min-height:260px" data-bind="meeting" data-field="transcript" ${bindAttr} placeholder="Maya: How's the supplier review going?&#10;Sam: Good — I'll send the shortlist by Friday...">${esc(m.transcript)}</textarea></div>
          <div class="row"><button class="btn primary" data-action="summarise" ${bindAttr}>Draft summary from transcript</button>
            <button class="btn" data-action="sample-transcript" ${bindAttr}>Use a sample transcript</button></div>
        </div>
        <div class="card">
          <h3>Summary</h3>
          <div class="notice amber small">Demo: this summary is drafted with simple keyword matching. The real version will use Claude to write it. Always check and edit before saving.</div>
          <div class="field"><label>Summary</label><textarea data-bind="meeting" data-field="summary" ${bindAttr}>${esc(m.summary)}</textarea></div>
          <div class="field"><label>Actions (one per line)</label><textarea data-bind="meeting" data-field="actions" ${bindAttr}>${esc(m.actions.join('\n'))}</textarea></div>
          <div class="field"><label>Wins (one per line)</label><textarea data-bind="meeting" data-field="wins" ${bindAttr}>${esc(m.wins.join('\n'))}</textarea></div>
          <div class="field"><label>Concerns or blockers (one per line)</label><textarea data-bind="meeting" data-field="concerns" ${bindAttr}>${esc(m.concerns.join('\n'))}</textarea></div>
          <div class="row">${isNew ? `<button class="btn primary" data-action="save-meeting">Save 1:1 notes</button>` : `<span class="muted small">Changes save automatically.</span> <button class="link small" data-action="delete-meeting" data-id="${m.id}">Delete</button>`}</div>
        </div>
      </div>`;
  }
  function demoSummarise(text) {
    const sentences = [];
    text.split(/\n+/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const m = line.match(/^([A-Z][\w .'-]{0,30}):\s*(.*)$/);
      const speaker = m ? m[1].trim() : null;
      const body = m ? m[2] : line;
      body.split(/(?<=[.!?])\s+/).forEach((s) => { s = s.trim(); if (s.length > 3) sentences.push({ speaker, s }); });
    });
    const used = new Set();
    const pick = (re, fix) => sentences.filter((x) => re.test(x.s)).map((x) => { used.add(x); return fix ? fix(x) : x.s; });
    const actions = pick(/\b(i'll|i will|we'll|we will|can you|could you|action|next step|follow up|going to|by (monday|tuesday|wednesday|thursday|friday|next week|the end of))\b/i,
      (x) => {
        if (!x.speaker) return x.s;
        const who = x.speaker.split(' ')[0];
        return x.s.replace(/^((yes|yeah|ok|okay|so|sure|noted|great)[,.!]?\s*)+/i, '')
          .replace(/^i('ll| will)\b/i, who + ' will')
          .replace(/^i'm going to\b/i, who + ' is going to')
          .replace(/^we('ll| will)\b/i, 'We will')
          .replace(/^./, (c) => c.toUpperCase());
      });
    const concerns = pick(/\b(worr|concern|blocker|blocked|struggl|difficult|stress|overwhelm|frustrat|too many|risk|behind)/i);
    const wins = pick(/\b(great|well done|proud|shipped|launched|finished|completed|nailed|happy with|good job)/i);
    const rest = sentences.filter((x) => !used.has(x) && x.s.length > 30 && !/\?$/.test(x.s)).slice(0, 3).map((x) => x.s);
    const people = [...new Set(sentences.map((x) => x.speaker).filter(Boolean))];
    const summary = sentences.length
      ? `${people.length ? people.join(' and ') + ' discussed ' : 'Discussed '}${sentences.length} points.${rest.length ? ' Main points: ' + rest.join(' ') : ''}`
      : '';
    return { summary, actions, wins, concerns };
  }
  function sampleTranscript(leadName, empName) {
    const L = leadName.split(' ')[0], E = empName.split(' ')[0];
    return `${L}: Thanks for making time. How has the last couple of weeks been?
${E}: Pretty good overall. We finished the supplier review and I'm really happy with how it went.
${L}: Great, well done on that. What's the saving looking like?
${E}: About 6 percent so far, the target was 10. The cleaning contract is the big one still open.
${L}: Can you send me the shortlist for that by Friday?
${E}: Yes, I'll send it by Friday.
${E}: One thing I'm worried about is the number of small requests coming in on Slack. It's hard to focus on the bigger projects.
${L}: That makes sense. I'll talk to the team about using the ops request form instead.
${E}: That would help a lot.
${L}: For the February review, remember the self-review is due on the 7th.
${E}: Noted. I'm going to start it next week.
${L}: Anything else blocking you?
${E}: Not really, just need a decision on the new payroll provider so I can start onboarding.
${L}: I will get you a decision by the end of next week.`;
  }

  function viewFramework() {
    const order = ['Lead', 'Senior', 'Mid', 'Junior'];
    const tb = FW.talentBar;
    const role = FW.roles[ui.fwRole];
    const secs = FW.companySections.concat(role.sections);
    return `
      <div class="page-head"><h1>Scorecard & talent bar</h1><div class="muted">The Neutreeno performance framework every review uses.</div></div>
      <div class="grid2">
        <div class="card">
          <h2>Talent bar</h2>
          <p class="muted" style="margin-top:0">The level expected in each area at each seniority.</p>
          <div class="tb-grid">
            <div class="tb-head"></div><div class="tb-head">Skills<div class="muted small">Role-specific</div></div><div class="tb-head">Deliverables<div class="muted small">Company-wide</div></div><div class="tb-head">Culture<div class="muted small">Company-wide</div></div>
            ${order.map((s) => `<div class="tb-cell"><b>${s}</b></div>${['Skills', 'Deliverables', 'Culture'].map((a) => `<div class="tb-cell">${lvlChip(tb[s][a])}</div>`).join('')}`).join('')}
          </div>
        </div>
        <div class="card">
          <h2>How grades work</h2>
          <ul class="plain">
            <li>Each line is rated <b>Poor → Basic → Intermediate → Advanced → Exceptional</b>.</li>
            <li>A <b>section's</b> grade is the average of its lines, rounded to the nearest level (e.g. 4 Intermediate + 2 Basic = Intermediate).</li>
            <li>An <b>area's</b> grade (Culture, Deliverables, Skills) is the average of its section grades, rounded.</li>
            <li>Compared with the talent bar: below = <span class="verdict Underperformer">Underperformer</span>, at = <span class="verdict Above-the-Bar">Above the Bar</span>, above = <span class="verdict A-player">A-player</span>.</li>
            <li><b>Overall:</b> Underperformer if any area is below the bar; A-player if two or more areas are above it; otherwise Above the Bar.</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <div class="spread"><h2 style="margin:0">Scorecard wording</h2>
          <label class="row">Role <select data-action="fw-role">${Object.entries(FW.roles).map(([k, r]) => `<option value="${k}" ${k === ui.fwRole ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label></div>
        ${FW.areas.map((area) => `<div class="area-title" style="margin-top:20px">${area}</div>` + secs.filter((s) => s.area === area).map((s) => `
          <h3 style="margin-top:14px">${esc(s.name)}</h3>
          <div style="overflow-x:auto"><table class="small">
            <tr><th style="width:140px">Line</th>${LEVELS.map((L) => `<th>${L}</th>`).join('')}</tr>
            ${s.traits.map((t) => `<tr><td><b>${esc(s.traits.length === 1 ? s.name : t.name)}</b></td>${t.levels.map((x) => `<td style="vertical-align:top">${esc(x)}</td>`).join('')}</tr>`).join('')}
          </table></div>`).join('')).join('')}
      </div>`;
  }

  const notFound = () => '<div class="card empty-state">Page not found. <a href="#/">Go home</a></div>';

  // ---------------------------------------------------------------- router
  function routeParts() { return (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent); }
  function render() {
    const parts = routeParts();
    const p = me();
    let html;
    switch (parts[0]) {
      case undefined: html = hasScorecard(p) ? viewHome() : isLead(p.id) ? viewTeam() : viewNoScorecard(); break;
      case 'all': html = isOps(p.id) ? viewAll() : notFound(); break;
      case 'team': html = isLead(p.id) ? viewTeam() : notFound(); break;
      case 'review': html = viewReview(parts[1]); break;
      case 'compare': html = viewCompare(parts[1], parts[2]); break;
      case 'goals': html = viewGoals(); break;
      case 'one-on-ones': html = parts[1] ? viewMeeting(parts[1]) : viewMeetings(); break;
      case 'framework': html = viewFramework(); break;
      default: html = notFound();
    }
    const y = window.scrollY;
    renderTopbar();
    renderNav(parts);
    $('#main').innerHTML = html;
    if (location.hash !== lastHash) { window.scrollTo(0, 0); lastHash = location.hash; } else window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', (ev) => {
    const row = ev.target.closest('tr[data-href]');
    if (row && !ev.target.closest('a,button,input,select,textarea,details')) { location.hash = row.dataset.href; return; }
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const a = el.dataset.action;
    const r = el.dataset.review ? state.reviews.find((x) => x.id === el.dataset.review) : null;

    if (a === 'pick' && r && canEdit(r)) {
      r.answers[el.dataset.key] = Number(el.dataset.level);
      if (r.status === 'not_started') r.status = 'draft';
      save(); render();
    } else if (a === 'open-review') {
      const target = person(el.dataset.e);
      const mayWrite = hasScorecard(target) && (el.dataset.t === 'self' ? el.dataset.e === state.viewAs : isDirectLead(state.viewAs, el.dataset.e));
      if (!mayWrite) return;
      const rv = ensureReview(el.dataset.c, el.dataset.e, el.dataset.t);
      save();
      location.hash = '#/review/' + rv.id;
    } else if (a === 'save-draft') {
      toast('Draft saved');
    } else if (a === 'submit-review' && r && canEdit(r)) {
      const p = person(r.employeeId);
      const sc = scoreReview(p, r.answers);
      if (sc.answered < sc.total) { toast(`Please rate every line first (${sc.answered} of ${sc.total} done)`); return; }
      if (!confirm('Submit this review? You won\'t be able to change it afterwards.')) return;
      r.status = 'submitted';
      r.submittedAt = today();
      save();
      toast('Review submitted');
      if (r.type === 'lead' && isSubmitted(getReview(r.cycleId, r.employeeId, 'self'))) location.hash = `#/compare/${r.cycleId}/${r.employeeId}`;
      else if (r.type === 'lead') location.hash = '#/team';
      else location.hash = '#/';
    } else if (a === 'add-kpi' && r && canEdit(r)) {
      r.kpis.push({ text: '', achieved: '', link: '' }); save(); render();
    } else if (a === 'remove-kpi' && r && canEdit(r)) {
      r.kpis.splice(Number(el.dataset.i), 1); save(); render();
    } else if (a === 'toggle-diffs') {
      ui.onlyDiffs = el.checked; render();
    } else if (a === 'hold-discussion' && canLogDiscussion(el.dataset.c, el.dataset.e)) {
      const o = outcome(el.dataset.c, el.dataset.e);
      o.discussed = true;
      if (!o.date) o.date = today();
      save(); toast('Discussion marked as held'); render();
    } else if (a === 'reopen-discussion' && canLogDiscussion(el.dataset.c, el.dataset.e)) {
      outcome(el.dataset.c, el.dataset.e).discussed = false; save(); render();
    } else if (a === 'goal-filter') {
      ui.goalFilter = el.dataset.f; render();
    } else if (a === 'toggle-goal-form') {
      ui.showGoalForm = !ui.showGoalForm; render();
    } else if (a === 'add-goal') {
      const val = (id) => $('#' + id).value;
      if (!val('g-title').trim()) { toast('Give the goal a name'); return; }
      state.goals.push({
        id: 'g' + Date.now(), title: val('g-title').trim(), level: val('g-level'), ownerId: val('g-owner'),
        start: Number(val('g-start')) || 0, current: Number(val('g-current')) || 0, target: Number(val('g-target')) || 0,
        unit: val('g-unit').trim(), due: val('g-due'),
      });
      ui.showGoalForm = false; save(); toast('Goal added'); render();
    } else if (a === 'delete-goal') {
      if (!confirm('Delete this goal?')) return;
      state.goals = state.goals.filter((g) => g.id !== el.dataset.id); save(); render();
    } else if (a === 'summarise') {
      const m = meetingFor(el.dataset.meeting);
      if (!m.transcript.trim()) { toast('Paste a transcript first'); return; }
      Object.assign(m, demoSummarise(m.transcript));
      if (el.dataset.meeting !== 'new') save();
      render(); toast('Summary drafted — check it before saving');
    } else if (a === 'sample-transcript') {
      const m = meetingFor(el.dataset.meeting);
      const v = me();
      const otherId = el.dataset.meeting === 'new' ? m.otherId : (m.leadId === v.id ? m.employeeId : m.leadId);
      const other = person(otherId);
      const leadIsMe = reportsOf(v.id).some((p) => p.id === otherId);
      m.transcript = leadIsMe ? sampleTranscript(v.name, other.name) : sampleTranscript(other.name, v.name);
      render();
    } else if (a === 'save-meeting') {
      const d = ui.meetingDraft;
      const v = me();
      const leadIsMe = reportsOf(v.id).some((p) => p.id === d.otherId);
      const m = { id: 'm' + Date.now(), leadId: leadIsMe ? v.id : d.otherId, employeeId: leadIsMe ? d.otherId : v.id, date: d.date, transcript: d.transcript, summary: d.summary, actions: d.actions, wins: d.wins, concerns: d.concerns };
      state.oneOnOnes.push(m);
      ui.meetingDraft = null;
      save(); toast('1:1 notes saved');
      location.hash = '#/one-on-ones/' + m.id;
    } else if (a === 'delete-meeting') {
      if (!confirm('Delete these 1:1 notes?')) return;
      state.oneOnOnes = state.oneOnOnes.filter((m) => m.id !== el.dataset.id); save();
      location.hash = '#/one-on-ones';
    } else if (a === 'sign-out') {
      try { localStorage.removeItem(window.DEMO_GATE.key); } catch (e) {}
      ui.meetingDraft = null;
      location.hash = '#/';
      showSignIn();
    } else if (a === 'reset-demo') {
      if (!confirm('Reset all demo data back to the start? Any changes you made will be lost.')) return;
      localStorage.removeItem(STORE);
      state = loadState();
      ui.meetingDraft = null;
      location.hash = '#/';
      render();
    }
  });
  function meetingFor(id) { return id === 'new' ? ui.meetingDraft : state.oneOnOnes.find((x) => x.id === id); }

  function onInput(ev) {
    const el = ev.target;
    const b = el.dataset.bind;
    if (!b) return;
    if (b === 'meeting') {
      const m = meetingFor(el.dataset.meeting);
      if (!m) return;
      const f = el.dataset.field;
      m[f] = ['actions', 'wins', 'concerns'].includes(f) ? el.value.split('\n').map((x) => x.trim()).filter(Boolean) : el.value;
      if (el.dataset.meeting !== 'new') save();
      return;
    }
    if (b === 'discussion') {
      if (!canLogDiscussion(el.dataset.c, el.dataset.e)) return;
      outcome(el.dataset.c, el.dataset.e)[el.dataset.field] = el.value; save(); return;
    }
    if (b === 'goal-current') {
      if (ev.type !== 'change') return;
      const g = state.goals.find((x) => x.id === el.dataset.id);
      if (g) { g.current = Number(el.value) || 0; save(); render(); }
      return;
    }
    const r = state.reviews.find((x) => x.id === el.dataset.review);
    if (!r || !canEdit(r)) return;
    const i = Number(el.dataset.i);
    if (b === 'comment') r.comments[el.dataset.key] = el.value;
    else if (b === 'strength') r.strengths[i] = el.value;
    else if (b === 'improvement') r.improvements[i] = el.value;
    else if (b === 'kpi') r.kpis[i][el.dataset.field] = el.value;
    if (r.status === 'not_started') r.status = 'draft';
    save();
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'viewas') {
      state.viewAs = el.value; ui.goalFilter = null; ui.meetingDraft = null; save();
      location.hash = '#/'; render(); return;
    }
    if (el.dataset.action === 'fw-role') { ui.fwRole = el.value; render(); return; }
    if (el.dataset.bind === 'goal-current') onInput(ev);
    if (el.dataset.bind === 'meeting' && el.tagName === 'SELECT') onInput(ev);
  });
  window.addEventListener('hashchange', render);

  // ---------------------------------------------------------------- sign-in (see gate.js)
  function showSignIn() {
    const sel = $('#signin-person');
    const teams = [...new Set(state.people.map((p) => p.team || 'Team'))];
    sel.innerHTML = teams.map((t) => `<optgroup label="${esc(t)}">${state.people.filter((p) => (p.team || 'Team') === t)
      .map((p) => `<option value="${p.id}" ${p.id === state.viewAs ? 'selected' : ''}>${esc(p.name)} — ${esc(p.title)}</option>`).join('')}</optgroup>`).join('');
    $('#signin-password').value = '';
    $('#signin-error').textContent = '';
    document.documentElement.classList.add('signed-out');
    $('#signin-password').focus();
  }
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  $('#signin-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const gate = window.DEMO_GATE;
    const pw = $('#signin-password').value;
    if (!pw) { $('#signin-error').textContent = 'Enter the demo password.'; return; }
    if (!window.crypto || !crypto.subtle) { $('#signin-error').textContent = 'This browser can\'t check the password here. Try the hosted link.'; return; }
    if ((await sha256(gate.salt + pw)) !== gate.hash) {
      $('#signin-error').textContent = 'That password isn\'t right.';
      $('#signin-password').select();
      return;
    }
    try { localStorage.setItem(gate.key, gate.hash); } catch (e) {}
    state.viewAs = $('#signin-person').value; ui.goalFilter = null; ui.meetingDraft = null; save();
    document.documentElement.classList.remove('signed-out');
    location.hash = '#/';
    render();
  });

  if (document.documentElement.classList.contains('signed-out')) showSignIn();
  render();
})();
