// Made-up people and reviews for the prototype. None of this is real employee data.
// The app builds this once and then saves changes in your browser.

// Mirrors the shape of the real Neutreeno org chart (November 2026), with made-up names.
// team: groups people in the "Viewing as" list. opsAccess: can see every submitted review (runs the cycle).
// role: which scorecard they use (null = no scorecard for that role yet).
window.DEMO_PEOPLE = [
  { id: 'daniel', name: 'Daniel Reyes',    title: 'CEO & Founder',                       team: 'Leadership',      role: null,       seniority: null,     leadId: null },
  // Operations
  { id: 'maya',   name: 'Maya Okafor',     title: 'Ops & Finance Lead',                  team: 'Operations',      role: 'ops',      seniority: 'Lead',   leadId: 'daniel', opsAccess: true },
  { id: 'sam',    name: 'Sam Whitfield',   title: 'Ops Specialist / Founding Generalist', team: 'Operations',     role: 'ops',      seniority: 'Junior',    leadId: 'maya',   opsAccess: true },
  // Software
  { id: 'leo',    name: 'Leo Marchetti',   title: 'Head of Software',                    team: 'Software',        role: 'software', seniority: 'Lead',   leadId: 'daniel' },
  { id: 'theo',   name: 'Theo Becker',     title: 'Senior Software Engineer',            team: 'Software',        role: 'software', seniority: 'Senior', leadId: 'leo' },
  { id: 'nina',   name: 'Nina Rossi',      title: 'Senior Software Engineer',            team: 'Software',        role: 'software', seniority: 'Senior', leadId: 'leo' },
  // Engineering
  { id: 'alan',   name: 'Prof Alan Hughes', title: 'Head of Engineering (part-time)',    team: 'Engineering',     role: null,       seniority: 'Lead',   leadId: 'daniel' },
  { id: 'hannah', name: 'Hannah Kim',      title: 'Climate Systems Engineering Lead',    team: 'Engineering',     role: 'carbon',   seniority: 'Lead',   leadId: 'alan' },
  { id: 'oliver', name: 'Oliver Grant',    title: 'Decarbonisation Model Engineer',      team: 'Engineering',     role: 'carbon',   seniority: 'Senior', leadId: 'hannah' },
  { id: 'zara',   name: 'Zara Ahmed',      title: 'Carbon Data Engineer',                team: 'Engineering',     role: 'carbon',   seniority: 'Junior', leadId: 'hannah' },
  { id: 'priya',  name: 'Priya Nair',      title: 'ML Engineer',                         team: 'Engineering',     role: 'software', seniority: 'Mid',    leadId: 'hannah' },
  // Engineering team, but reports straight to the CEO
  { id: 'aisha',  name: 'Aisha Bello',     title: 'Senior Carbon Analyst',               team: 'Engineering',     role: 'carbon',   seniority: 'Senior', leadId: 'daniel' },
  // Product
  { id: 'elena',  name: 'Elena Novak',     title: 'Head of Product (part-time)',         team: 'Product',         role: null,       seniority: 'Lead',   leadId: 'daniel' },
  // Revenue
  { id: 'marcus', name: 'Marcus Hale',     title: 'Revenue Lead (part-time)',            team: 'Revenue',         role: null,       seniority: 'Lead',   leadId: 'daniel' },
  { id: 'jade',   name: 'Jade Thompson',   title: 'Account Executive',                   team: 'Revenue',         role: null,       seniority: 'Mid',    leadId: 'marcus' },
  { id: 'felipe', name: 'Felipe Duarte',   title: 'Account Executive',                   team: 'Revenue',         role: null,       seniority: 'Mid',    leadId: 'marcus' },
  { id: 'fatima', name: 'Fatima Rahman',   title: 'Customer Success Lead',               team: 'Revenue',         role: null,       seniority: 'Senior', leadId: 'marcus' },
  { id: 'ryan',   name: 'Ryan Patel',      title: 'BDR',                                 team: 'Revenue',         role: null,       seniority: 'Junior', leadId: 'jade' },
  { id: 'chloe',  name: 'Chloe Martin',    title: 'BDR',                                 team: 'Revenue',         role: null,       seniority: 'Junior', leadId: 'jade' },
  { id: 'owen',   name: 'Owen Price',      title: 'BDR',                                 team: 'Revenue',         role: null,       seniority: 'Junior', leadId: 'felipe' },
  { id: 'kit',    name: 'Kit Lawson',      title: 'RevOps (part-time)',                  team: 'Revenue',         role: null,       seniority: 'Mid',    leadId: 'daniel' },
];

// Roles we're hiring for, shown on the team lead's page.
window.DEMO_OPEN_ROLES = [
  { id: 'open1', title: 'Decarbonisation Model Engineer', leadId: 'hannah' },
  { id: 'open2', title: 'Carbon Analysis Engineer',       leadId: 'hannah' },
  { id: 'open3', title: 'Founding UX Designer',           leadId: 'elena' },
  { id: 'open4', title: 'Growth Marketing Lead',          leadId: 'daniel' },
];

window.DEMO_CYCLES = [
  {
    id: '2026-08', name: 'August 2026', status: 'closed',
    stages: [
      { key: 'self',    name: 'Self-review',       due: '2026-08-07' },
      { key: 'lead',    name: 'Team lead review',  due: '2026-08-07' },
      { key: 'discuss', name: 'Review discussion', due: '2026-08-14' },
    ],
  },
  {
    id: '2027-02', name: 'February 2027', status: 'open',
    stages: [
      { key: 'self',    name: 'Self-review',       due: '2027-02-07' },
      { key: 'lead',    name: 'Team lead review',  due: '2027-02-07' },
      { key: 'discuss', name: 'Review discussion', due: '2027-02-14' },
    ],
  },
];

window.buildDemoState = function (FW) {
  // Small predictable random generator so the demo looks the same every time.
  function rng(seed) {
    let a = 0;
    for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v) => Math.max(0, Math.min(4, v));
  const people = window.DEMO_PEOPLE.map((p) => ({ ...p }));
  const sectionsFor = (p) => FW.companySections.concat(p.role ? FW.roles[p.role].sections : []);

  // Answers around a target level per area, e.g. { Culture: 2, Deliverables: 2, Skills: 1 }
  function answers(p, target, seed, fraction) {
    const r = rng(seed);
    const out = {};
    const secs = sectionsFor(p);
    let i = 0;
    const total = secs.reduce((n, s) => n + s.traits.length, 0);
    const limit = fraction == null ? total : Math.round(total * fraction);
    for (const s of secs) {
      for (const t of s.traits) {
        if (i++ >= limit) return out;
        const x = r();
        const noise = x < 0.15 ? -1 : x > 0.85 ? 1 : 0;
        out[s.id + '::' + t.id] = clamp(target[s.area] + noise);
      }
    }
    return out;
  }
  // A team lead's answers that differ from the self-review in places.
  function leadView(p, selfAnswers, seed, shift) {
    const r = rng(seed);
    const out = {};
    for (const s of sectionsFor(p)) {
      for (const t of s.traits) {
        const k = s.id + '::' + t.id;
        const base = selfAnswers[k];
        const x = r();
        let d = 0;
        if (x < (shift[s.area] || 0)) d = r() < 0.25 ? -2 : -1;
        else if (x > 0.93) d = 1;
        out[k] = clamp(base + d);
      }
    }
    return out;
  }

  const reviews = [];
  const outcomes = {};
  function addReview(cycleId, empId, type, ans, status, extra) {
    const p = people.find((x) => x.id === empId);
    reviews.push({
      id: cycleId + ':' + empId + ':' + type,
      cycleId, employeeId: empId, type,
      reviewerId: type === 'self' ? empId : p.leadId,
      answers: ans || {}, comments: {}, strengths: ['', '', ''], improvements: ['', '', ''],
      status, submittedAt: status === 'submitted' ? (cycleId === '2027-02' ? '2027-02-05' : '2026-08-10') : null,
      ...(extra || {}),
    });
  }

  // ---- Previous cycle (August 2026): everyone finished and results shared ----
  const past = {
    maya: { Culture: 2, Deliverables: 2, Skills: 3 }, leo: { Culture: 2, Deliverables: 3, Skills: 3 },
    hannah: { Culture: 2, Deliverables: 2, Skills: 2 }, sam: { Culture: 1, Deliverables: 1, Skills: 1 },
    aisha: { Culture: 2, Deliverables: 2, Skills: 2 }, theo: { Culture: 2, Deliverables: 2, Skills: 2 },
    nina: { Culture: 1, Deliverables: 1, Skills: 2 }, oliver: { Culture: 2, Deliverables: 2, Skills: 2 },
    zara: { Culture: 1, Deliverables: 1, Skills: 1 },
  };
  for (const id of Object.keys(past)) {
    const p = people.find((x) => x.id === id);
    const self = answers(p, past[id], 'past-self-' + id);
    addReview('2026-08', id, 'self', self, 'submitted');
    addReview('2026-08', id, 'lead', leadView(p, self, 'past-lead-' + id, { Skills: 0.2, Culture: 0.1 }), 'submitted', {
      strengths: ['Reliable and calm under pressure', 'Clear written updates', ''],
      improvements: ['Take on more ambiguous problems', '', ''],
    });
    outcomes['2026-08:' + id] = { discussed: true, date: '2026-08-13', notes: 'Went through the side-by-side together and agreed the grades.', transcript: '' };
  }

  // ---- Current cycle (February 2027): a mix of stages ----
  const P = (id) => people.find((x) => x.id === id);

  // Sam: both reviews submitted, not yet shared -> good example of side-by-side comparison
  const samSelf = answers(P('sam'), { Culture: 1, Deliverables: 2, Skills: 2 }, 'sam-self');
  addReview('2027-02', 'sam', 'self', samSelf, 'submitted', {
    comments: {
      'get-it-done': 'Ran the office move end-to-end in three weeks with no budget overrun.',
      'financial-management': 'Rebuilt the monthly cash-flow tracker and now send it on the 3rd of each month.',
    },
    strengths: ['Owning the office move', 'Monthly finance reporting', 'Supplier negotiations'],
    improvements: ['Board pack preparation', 'Delegating more', ''],
  });
  addReview('2027-02', 'sam', 'lead', leadView(P('sam'), samSelf, 'sam-lead', { Skills: 0.45, Culture: 0.15, Deliverables: 0.3 }), 'submitted', {
    comments: {
      'get-it-done': 'Agree the office move was excellent.',
      'financial-management': 'Tracker is good, but scenario modelling still needs a lot of support from me.',
      'operational-systems': 'Processes are mostly in people\'s heads — documenting them is the next step.',
    },
    strengths: ['Office move delivered on time and on budget', 'Very well liked by the team', 'Fast to pick up new tools'],
    improvements: ['Financial modelling and scenarios', 'Writing processes down', 'Speaking up earlier when blocked'],
  });

  // Aisha: self submitted, team lead review in progress
  const aishaSelf = answers(P('aisha'), { Culture: 2, Deliverables: 2, Skills: 2 }, 'aisha-self');
  addReview('2027-02', 'aisha', 'self', aishaSelf, 'submitted');
  addReview('2027-02', 'aisha', 'lead', answers(P('aisha'), { Culture: 2, Deliverables: 3, Skills: 2 }, 'aisha-lead', 0.4), 'draft');

  // Theo: finished and shared
  const theoSelf = answers(P('theo'), { Culture: 2, Deliverables: 2, Skills: 3 }, 'theo-self');
  addReview('2027-02', 'theo', 'self', theoSelf, 'submitted', {
    strengths: ['System design', 'Mentoring Nina', ''], improvements: ['Saying no to scope creep', '', ''],
  });
  addReview('2027-02', 'theo', 'lead', leadView(P('theo'), theoSelf, 'theo-lead', { Skills: 0.15 }), 'submitted', {
    strengths: ['Designed the new data pipeline', 'Great mentor to Nina', 'Calm during incidents'],
    improvements: ['Write more tests before shipping', 'Share design docs earlier', ''],
  });
  outcomes['2027-02:theo'] = {
    discussed: true, date: '2027-02-11',
    notes: 'Agreed Theo is ready to lead the reporting project next half. Main gap is testing before shipping.',
    transcript: [
      'Leo Marchetti: Thanks for making time. Shall we start with the areas where we rated you differently?',
      'Theo Becker: Sure. I think the biggest one was Engineering Craft.',
      "Leo Marchetti: Yes. I put you at Advanced rather than Exceptional, mainly because a couple of releases went out with thin test coverage.",
      "Theo Becker: That's fair. The export was rushed at the end. I'd like to set up a proper test checklist for the team.",
      "Leo Marchetti: Great, let's make that one of your goals. On everything else we were very close.",
      'Theo Becker: I also wanted to ask about leading the reporting project.',
      "Leo Marchetti: I think you're ready. Let's plan that for next half and review it at our March 1:1.",
    ].join('\n'),
  };

  // Nina: self-review half done
  addReview('2027-02', 'nina', 'self', answers(P('nina'), { Culture: 1, Deliverables: 1, Skills: 2 }, 'nina-self', 0.5), 'draft');

  // Zara: self submitted, team lead not started
  addReview('2027-02', 'zara', 'self', answers(P('zara'), { Culture: 1, Deliverables: 1, Skills: 1 }, 'zara-self'), 'submitted');

  // Leads
  addReview('2027-02', 'maya', 'self', answers(P('maya'), { Culture: 2, Deliverables: 2, Skills: 3 }, 'maya-self', 0.3), 'draft');
  const leoSelf = answers(P('leo'), { Culture: 2, Deliverables: 3, Skills: 3 }, 'leo-self');
  addReview('2027-02', 'leo', 'self', leoSelf, 'submitted');
  addReview('2027-02', 'leo', 'lead', leadView(P('leo'), leoSelf, 'leo-lead', { Culture: 0.25, Deliverables: 0.2 }), 'submitted', {
    strengths: ['Technical leadership', 'Hiring bar', ''], improvements: ['Cross-team communication', '', ''],
  });

  // ---- Goals ----
  const goals = [
    { id: 'g1', title: 'Annual recurring revenue', level: 'Company', ownerId: 'daniel', start: 1.2, current: 1.9, target: 3, unit: '£m', due: '2027-12-31' },
    { id: 'g2', title: 'Customers measured on the platform', level: 'Company', ownerId: 'daniel', start: 12, current: 31, target: 50, unit: '', due: '2027-12-31' },
    { id: 'g3', title: 'Team eNPS', level: 'Company', ownerId: 'maya', start: 20, current: 38, target: 50, unit: '', due: '2027-06-30' },
    { id: 'g4', title: 'Monthly close done within 5 working days', level: 'Team', ownerId: 'maya', start: 12, current: 7, target: 5, unit: 'days', due: '2027-03-31' },
    { id: 'g5', title: 'Platform uptime', level: 'Team', ownerId: 'leo', start: 98, current: 99.6, target: 99.5, unit: '%', due: '2027-06-30' },
    { id: 'g6', title: 'Product footprints delivered', level: 'Team', ownerId: 'hannah', start: 0, current: 140, target: 400, unit: '', due: '2027-06-30' },
    { id: 'g7', title: 'Supplier costs reduced', level: 'Personal', ownerId: 'sam', start: 0, current: 6, target: 10, unit: '%', due: '2027-02-28' },
    { id: 'g8', title: 'Process docs written', level: 'Personal', ownerId: 'sam', start: 0, current: 4, target: 12, unit: '', due: '2027-04-30' },
    { id: 'g9', title: 'Carbon report export shipped', level: 'Personal', ownerId: 'theo', start: 0, current: 100, target: 100, unit: '%', due: '2027-01-31' },
    { id: 'g10', title: 'Footprints completed', level: 'Personal', ownerId: 'zara', start: 0, current: 22, target: 60, unit: '', due: '2027-06-30' },
  ];

  // ---- 1:1 meetings ----
  const oneOnOnes = [
    {
      id: 'm1', leadId: 'maya', employeeId: 'sam', date: '2027-01-20',
      transcript: '',
      summary: 'Talked through the supplier review and the February review cycle. Sam is on track with costs but stretched across too many small tasks.',
      actions: ['Sam will send the supplier shortlist by Friday', 'Maya will move payroll admin off Sam\'s plate from March'],
      wins: ['Office move finished on budget'],
      concerns: ['Too many small requests coming in over Slack'],
    },
    {
      id: 'm2', leadId: 'leo', employeeId: 'theo', date: '2027-01-22',
      transcript: '',
      summary: 'Reviewed the reporting export launch and planning for next quarter.',
      actions: ['Theo will write the design doc for the pipeline v2', 'Leo will book time with Hannah about the pipeline'],
      wins: ['Export shipped a week early'],
      concerns: [],
    },
  ];

  return {
    version: 4,
    viewAs: 'maya',
    people, openRoles: window.DEMO_OPEN_ROLES.map((r) => ({ ...r })), cycles: window.DEMO_CYCLES.map((c) => ({ ...c })), reviews, outcomes, goals, oneOnOnes,
  };
};
