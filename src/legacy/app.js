// The GigoMe demo (every screen of the site), as it was in the old single
// index.html. The code is unchanged except for two things, so React can mount
// and unmount it:
//   * it runs inside mountLegacyApp() instead of on page load, and
//   * listeners on window and document go through on(), so unmount() can
//     remove them all.
// The markup it works on is src/legacy/markup.html, put in place by
// src/pages/Home.jsx before this runs.

export function mountLegacyApp() {
  const listeners = new AbortController();
  const on = (target, type, fn, options) =>
    target.addEventListener(type, fn, Object.assign({ signal: listeners.signal }, options));

  // ==========================================================================
  // Data (sample data for the demo)
  // ==========================================================================
  // rate = hourly-equivalent pay in €, used for the pay filter and sorting.
  // metro = nearest metro line(s); omitted where the nearest station is uncertain.
  var JOBS = [
    { id: 'd1', title: 'Trade fair event staff', company: 'Lumen Events', cat: 'day', area: 'Portello', metro: ['M5'], mode: 'On-site', when: ['Weekends'], lang: 'en', pay: '€100/day', rate: 12.5, duration: '1 day', posted: 1, match: 82 },
    { id: 'd2', title: 'Product sampling promoter', company: 'Fresca Drinks', cat: 'day', area: 'Centrale', metro: ['M2', 'M3'], mode: 'On-site', when: ['Weekdays'], lang: 'en', pay: '€90/day', rate: 11, duration: '1 day', posted: 3, match: 60 },
    { id: 'd3', title: 'Photo-shoot assistant', company: 'Studio Lambrate', cat: 'day', area: 'Lambrate', metro: ['M2'], mode: 'On-site', when: ['Weekends'], lang: 'en', pay: '€120/day', rate: 15, duration: '1 day', posted: 2, match: 78 },
    { id: 'd4', title: 'Conference registration desk', company: 'Brera Congress', cat: 'day', area: 'Brera', metro: ['M2'], mode: 'On-site', when: ['Weekdays'], lang: 'en-it', pay: '€110/day', rate: 13.75, duration: '1 day', posted: 5, match: 55 },
    { id: 'd5', title: 'Gallery opening host', company: 'Ortica Gallery', cat: 'day', area: 'Ortica', mode: 'On-site', when: ['Evenings'], lang: 'en', pay: '€70/evening', rate: 17.5, duration: '1 evening', posted: 4, match: 70 },
    { id: 't1', title: 'English conversation tutor', company: 'Brera Language Hub', cat: 'tutoring', area: 'Brera', metro: ['M2'], mode: 'On-site', when: ['Evenings'], lang: 'en', pay: '€15/h', rate: 15, duration: 'Ongoing', posted: 2, match: 88 },
    { id: 't2', title: 'Statistics tutor (high school)', company: 'Private family', cat: 'tutoring', area: 'Città Studi', metro: ['M2'], mode: 'On-site', when: ['Weekdays', 'Evenings'], lang: 'en', pay: '€22/h', rate: 22, duration: 'Ongoing', posted: 1, match: 91 },
    { id: 't3', title: 'Online maths tutor', company: 'LearnLoop', cat: 'tutoring', area: 'Remote', mode: 'Remote', when: ['Flexible'], lang: 'en', pay: '€18/h', rate: 18, duration: 'Ongoing', posted: 6, match: 84 },
    { id: 't4', title: 'GMAT prep tutor', company: 'Peak Prep Milano', cat: 'tutoring', area: 'Porta Romana', metro: ['M3'], mode: 'Hybrid', when: ['Evenings', 'Weekends'], lang: 'en', pay: '€30/h', rate: 30, duration: 'Ongoing', posted: 3, match: 86 },
    { id: 't5', title: 'Homework help in English', company: 'International family', cat: 'tutoring', area: 'CityLife', metro: ['M5'], mode: 'On-site', when: ['Weekdays'], lang: 'en', pay: '€14/h', rate: 14, duration: 'Ongoing', posted: 7, match: 66 },
    { id: 'p1', title: 'Market research sprint', company: 'Fintra', cat: 'project', area: 'Remote', mode: 'Remote', when: ['Flexible'], lang: 'en', pay: '€450/project', rate: 18.75, duration: '1 week', posted: 2, match: 90 },
    { id: 'p2', title: 'Pitch deck redesign', company: 'Tavola', cat: 'project', area: 'Isola', metro: ['M5'], mode: 'Hybrid', when: ['Flexible'], lang: 'en', pay: '€350/project', rate: 17.5, duration: '1 week', posted: 4, match: 85 },
    { id: 'p3', title: 'Customer interviews in English', company: 'Navigli Bike Tours', cat: 'project', area: 'Navigli', metro: ['M2'], mode: 'On-site', when: ['Weekends'], lang: 'en', pay: '€300/project', rate: 15, duration: '5 days', posted: 6, match: 72 },
    { id: 'p4', title: 'Social media content week', company: 'Nebbia Coffee Bar', cat: 'project', area: 'Porta Venezia', metro: ['M1'], mode: 'Hybrid', when: ['Flexible'], lang: 'en', pay: '€250/project', rate: 12.5, duration: '1 week', posted: 3, match: 74 },
    { id: 'p5', title: 'Competitor analysis for expansion', company: 'Ortica Studio', cat: 'project', area: 'Remote', mode: 'Remote', when: ['Flexible'], lang: 'en', pay: '€500/project', rate: 25, duration: '1 week', posted: 1, match: 93 },
    { id: 'i1', title: 'Marketing intern', company: 'Porta Studio', cat: 'internship', area: 'Isola', metro: ['M5'], mode: 'Hybrid', when: ['Weekdays'], lang: 'en', pay: '€800/month', rate: 10, duration: '3 months', posted: 5, match: 80 },
    { id: 'i2', title: 'Finance analyst intern', company: 'Fintra', cat: 'internship', area: 'Porta Romana', metro: ['M3'], mode: 'On-site', when: ['Weekdays'], lang: 'en', pay: '€1000/month', rate: 12.5, duration: '6 months', posted: 5, match: 89 },
    { id: 'i3', title: 'Social media intern', company: 'Tavola', cat: 'internship', area: 'Isola', metro: ['M5'], mode: 'Hybrid', when: ['Flexible'], lang: 'en', pay: '€600/month', rate: 9.5, duration: '3 months', posted: 2, match: 77 },
    { id: 'i4', title: 'Venture analyst intern', company: 'Brick Ventures', cat: 'internship', area: 'Porta Nuova', metro: ['M2'], mode: 'Hybrid', when: ['Weekdays'], lang: 'en', pay: '€1200/month', rate: 15, duration: '4 months', posted: 8, match: 87 },
    { id: 'w1', title: 'Weekend barista', company: 'Nebbia Coffee Bar', cat: 'parttime', area: 'Porta Venezia', metro: ['M1'], mode: 'On-site', when: ['Weekends'], lang: 'en', pay: '€11/h', rate: 11, duration: 'Ongoing', posted: 0, match: 79 },
    { id: 'w2', title: 'Business development assistant', company: 'Ortica Studio', cat: 'parttime', area: 'Ortica', mode: 'Hybrid', when: ['Evenings'], lang: 'en', pay: '€12/h', rate: 12, duration: 'Ongoing', posted: 7, match: 76 },
    { id: 'w3', title: 'Bike tour guide', company: 'Navigli Bike Tours', cat: 'parttime', area: 'Navigli', metro: ['M2'], mode: 'On-site', when: ['Weekends'], lang: 'en-it', pay: '€80/tour', rate: 20, duration: 'Ongoing', posted: 3, match: 69 },
    { id: 'w4', title: 'Remote data entry assistant', company: 'Casa Verde Hostels', cat: 'parttime', area: 'Remote', mode: 'Remote', when: ['Flexible'], lang: 'en', pay: '€13/h', rate: 13, duration: 'Ongoing', posted: 9, match: 64 },
    { id: 'w5', title: 'Front-of-house host', company: 'Sakura Navigli', cat: 'parttime', area: 'Navigli', metro: ['M2'], mode: 'On-site', when: ['Evenings'], lang: 'en', pay: '€12/h', rate: 12, duration: 'Ongoing', posted: 4, match: 58 }
  ];

  // Hand-written detail for the sample barista role. Other roles get text built from their data.
  var DETAIL = {
    w1: {
      schedule: 'Sat and Sun, 8:00 to 14:00', start: 'November',
      about: "We're a specialty coffee bar near the Porta Venezia metro with a mostly international crowd. We're looking for a friendly student to help behind the counter on weekend mornings: taking orders, preparing drinks and keeping the space tidy.",
      tasks: ['Serve customers in English. Italian is a plus, not required.', 'Prepare espresso drinks, with full training on your first day.', 'Help open the bar and keep the counter stocked.'],
      good: ['Shifts can be swapped around exam periods.', 'Free coffee and breakfast on shift.', 'Contract and pay are agreed directly with the employer.']
    }
  };

  // Employers. private = a person hiring (a family, someone who needs a dog walker), not a business.
  // verified: false = not (yet) checked by the GigoMe team.
  var COMPANY = {
    'Lumen Events': { sector: 'Events' },
    'Fresca Drinks': { sector: 'Food and drink brand' },
    'Studio Lambrate': { sector: 'Photography studio' },
    'Brera Congress': { sector: 'Conference venue' },
    'Ortica Gallery': { sector: 'Art gallery' },
    'Brera Language Hub': { sector: 'Language school', desc: 'A small language school in Brera. Students run English conversation groups for adult learners in the evening.' },
    'Private family': { private: true, desc: 'A family in Città Studi looking for a patient tutor to help their teenage son with statistics.' },
    'LearnLoop': { sector: 'Online tutoring', desc: 'An online tutoring platform matching university students with secondary-school pupils across Italy.' },
    'Peak Prep Milano': { sector: 'Test preparation' },
    'International family': { private: true, verified: false, desc: 'An English-speaking family in CityLife looking for after-school homework help for two children.' },
    'Fintra': { sector: 'Fintech startup', desc: 'A 20-person fintech startup building payment tools for small businesses. Office near Porta Romana, hybrid by default.' },
    'Tavola': { sector: 'Food-tech startup' },
    'Navigli Bike Tours': { sector: 'Tourism', desc: 'A small company running English-language bike tours along the canals and through the old town.' },
    'Nebbia Coffee Bar': { sector: 'Food and hospitality', site: 'nebbia-example.it', desc: 'Specialty coffee bar with a mostly international crowd. We hire students for weekend shifts and train everyone from scratch.' },
    'Ortica Studio': { sector: 'Strategy studio' },
    'Porta Studio': { sector: 'Design agency', verified: false },
    'Brick Ventures': { sector: 'Venture capital' },
    'Casa Verde Hostels': { sector: 'Hostels' },
    'Sakura Navigli': { sector: 'Restaurant' }
  };

  // Simulated company positions on the map (map units)
  var POS = {
    'Lumen Events': [165, 215], 'International family': [190, 330], 'Porta Studio': [420, 175],
    'Tavola': [540, 140], 'Brick Ventures': [520, 255], 'Fresca Drinks': [660, 215],
    'Studio Lambrate': [770, 130], 'Private family': [770, 290], 'Brera Language Hub': [390, 300],
    'Brera Congress': [480, 400], 'Nebbia Coffee Bar': [650, 380], 'Ortica Gallery': [760, 450],
    'Ortica Studio': [770, 540], 'Sakura Navigli': [210, 640], 'Navigli Bike Tours': [330, 690],
    'Peak Prep Milano': [640, 640], 'Fintra': [560, 760]
  };

  var SEED_REVIEWS = {
    'Navigli Bike Tours': [
      { rating: 5, text: 'Great team, and flexible about exam weeks. Tips are good on weekends.', author: 'Lena M.', role: 'Bike tour guide', date: '2026-09-21' },
      { rating: 4, text: 'Fun job, but tours in the rain are hard work.', author: null, role: 'Bike tour guide', date: '2026-07-02' }
    ],
    'Nebbia Coffee Bar': [
      { rating: 5, text: 'Good training on the first day and the owners are patient. Free breakfast helps.', author: 'Tomás R.', role: 'Weekend barista', date: '2026-10-12' },
      { rating: 4, text: 'Busy Sunday mornings, but shifts are easy to swap.', author: null, role: 'Weekend barista', date: '2026-08-30' }
    ],
    'Fintra': [{ rating: 4, text: 'Real work from week one. The hybrid schedule fits around lectures.', author: 'Priya S.', role: 'Finance analyst intern', date: '2026-06-15' }],
    'Brera Language Hub': [{ rating: 5, text: 'Friendly learners and clear lesson plans.', author: null, role: 'English conversation tutor', date: '2026-10-01' }],
    'Lumen Events': [{ rating: 3, text: 'Long days on your feet. Pay arrived on time.', author: 'Jonas K.', role: 'Trade fair event staff', date: '2026-09-05' }]
  };

  // The sample student and employer used by "Sign in" and the Jump to menu.
  var DEMO_PROFILE = {
    name: 'Alex Kim', username: 'alexkim', email: 'alex.kim@example.com', studentEmail: 'a.kim@student.example.com',
    age: '22', showAge: true, nationality: 'South Korean', showNat: false, programme: 'MSc Management', year: '2nd year',
    langs: [['English', 'Fluent'], ['Korean', 'Native'], ['Italian', 'Basic']], avail: ['Weekends', 'Evenings'],
    intro: 'Second-year management student looking for weekend work in hospitality or tutoring.',
    education: 'BSc Business Administration in Seoul. Now MSc Management in Milan.',
    experience: 'Barista at a café in Seoul for a year. Maths tutor for two high-school students.',
    ambitions: 'Consumer marketing, and one day my own café brand.',
    personality: 'Calm under pressure and happy talking to strangers.',
    soft: 'Customer service, teamwork, time management', hard: 'Excel, basic SQL, espresso machines', alerts: true
  };
  var DEMO_EMPLOYER = {
    type: 'business', name: 'Nebbia Coffee Bar', sector: 'Food and hospitality', area: 'Porta Venezia', showLocation: true,
    contactName: 'Giulia Ferri', email: 'jobs@nebbia-example.it', phone: '+39 02 0000 0000', site: 'nebbia-example.it',
    desc: COMPANY['Nebbia Coffee Bar'].desc, verify: 'verified'
  };
  var SEED_LISTINGS = [
    { id: 'w1', title: 'Weekend barista', cat: 'parttime', status: 'Live', updated: 'Today', job: 'w1' },
    { id: 'p4', title: 'Social media content week', cat: 'project', status: 'Live', updated: '3 days ago', job: 'p4' },
    { id: 'l2', title: 'Latte art workshop helper', cat: 'day', status: 'In review', updated: 'Yesterday',
      draft: { title: 'Latte art workshop helper', cat: 'day', area: 'Porta Venezia', metro: ['M1'], mode: 'On-site', when: ['Weekends'], lang: 'en', pay: '€80/day', rate: 10, duration: '1 day', desc: 'Help our baristas run a Saturday latte art workshop for customers: set up, hand out cups and keep the counter clean.' } },
    { id: 'l3', title: 'Evening closing shift', cat: 'parttime', status: 'Draft', updated: '3 days ago',
      draft: { title: 'Evening closing shift', cat: 'parttime', area: 'Porta Venezia', when: ['Evenings'], lang: 'en', pay: '€11/h', desc: '' } }
  ];
  var SEED_APPLICANTS = {
    w1: [
      { name: 'Sofia Brandt', programme: 'BA Economics, 1st year', langs: [['English', 'Fluent'], ['German', 'Native']], avail: ['Weekends'], date: '2026-11-03', via: 'email', status: 'Applied' },
      { name: 'Daniel Okafor', programme: 'MSc Data Science, 2nd year', langs: [['English', 'Native'], ['Italian', 'Basic']], avail: ['Weekends', 'Evenings'], date: '2026-11-02', via: 'site', status: 'Applied' },
      { name: 'Mei Lin', programme: 'Exchange student', langs: [['English', 'Fluent'], ['Mandarin', 'Native']], avail: ['Weekends'], date: '2026-10-20', via: 'email', status: 'Accepted' },
      { name: 'Lucas Martin', programme: 'BA Design, 3rd year', langs: [['English', 'Fluent'], ['French', 'Native']], avail: ['Evenings'], date: '2026-10-18', via: 'site', status: 'Rejected' }
    ],
    p4: [
      { name: 'Hana Sato', programme: 'BA Communication, 3rd year', langs: [['English', 'Fluent'], ['Japanese', 'Native']], avail: ['Remote'], date: '2026-11-01', via: 'email', status: 'Applied' },
      { name: 'Omar Haddad', programme: 'MSc Marketing, 1st year', langs: [['English', 'Fluent'], ['Arabic', 'Native']], avail: ['Weekends', 'Remote'], date: '2026-10-31', via: 'email', status: 'Applied' }
    ]
  };
  var SEED_PAST = [
    { name: 'Mei Lin', role: 'Weekend barista', last: 'October 2026', recurring: true },
    { name: 'Tomás Rivera', role: 'Weekend barista', last: 'August 2026', recurring: true },
    { name: 'Ana Popescu', role: 'Social media content week', last: 'June 2026', recurring: false }
  ];
  var SEED_QUEUE = [
    { kind: 'Listing', title: 'Latte art workshop helper', detail: 'Nebbia Coffee Bar, day job', submitted: 'Yesterday', listing: 'l2' },
    { kind: 'Company', title: 'Porta Studio', detail: 'Design agency, Isola. Asked to be verified.', submitted: '2 days ago', company: 'Porta Studio' },
    { kind: 'Student', title: 'Unrecognised student email', detail: 'Exchange student, domain not on the list', submitted: 'Today' },
    { kind: 'Listing', title: 'Tour guide, Duomo rooftops', detail: 'Navigli Bike Tours, day job', submitted: 'Today',
      job: { title: 'Tour guide, Duomo rooftops', company: 'Navigli Bike Tours', cat: 'day', area: 'Duomo', metro: ['M1', 'M3'], mode: 'On-site', when: ['Weekends'], lang: 'en', pay: '€75/day', rate: 12.5, duration: '1 day' } }
  ];
  var SEED_STUDENTS = [
    { name: 'Sofia Brandt', programme: 'BA Economics', joined: '28 Oct' },
    { name: 'Daniel Okafor', programme: 'MSc Data Science', joined: '30 Oct' },
    { name: 'Hana Sato', programme: 'BA Communication', joined: '1 Nov' },
    { name: 'Mei Lin', programme: 'Exchange student', joined: '2 Oct' }
  ];
  var TEAM = [
    { name: 'Matteo Scarano', role: 'Project lead' },
    { name: 'Aaryan' },
    { name: 'David Kohn' },
    { name: 'Emil Davidsson' },
    { name: 'Francesco' },
    { name: 'Kaushik Jay' },
    { name: 'Marc' },
    { name: 'Taha' },
    { name: 'Yujin Nakamura' }
  ];
  // Main contact address, shown in the footer on every page. Change it here only.
  var CONTACT_EMAIL = 'hello@gigome.org';
  // Contact details on the About page. Placeholders: replace before launch.
  // Leave linkedin empty to show "coming soon".
  var CONTACT = {
    students: { email: 'students@gigome.example', phone: '+39 000 000 0000', linkedin: '' },
    employers: { email: 'employers@gigome.example', phone: '+39 000 000 0000', linkedin: '' }
  };

  var TYPES = [['parttime', 'Part-time'], ['day', 'Day job'], ['tutoring', 'Tutoring'], ['project', 'Short project'], ['internship', 'Internship']];
  var TYPE = {}; TYPES.forEach(function (t) { TYPE[t[0]] = t[1]; });
  var HIGH_PAY = 18;
  var LANGS = ['Arabic', 'Chinese (Mandarin)', 'Dutch', 'English', 'French', 'German', 'Greek', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Polish', 'Portuguese', 'Romanian', 'Russian', 'Spanish', 'Swedish', 'Turkish', 'Ukrainian', 'Urdu', 'Vietnamese'];
  var NATIONALITIES = ['American', 'Brazilian', 'British', 'Canadian', 'Chinese', 'Colombian', 'Dutch', 'Egyptian', 'French', 'German', 'Greek', 'Indian', 'Indonesian', 'Iranian', 'Italian', 'Japanese', 'Mexican', 'Moroccan', 'Nigerian', 'Pakistani', 'Polish', 'Portuguese', 'Romanian', 'Russian', 'South Korean', 'Spanish', 'Swedish', 'Turkish', 'Ukrainian', 'Vietnamese'];
  var PERSONAL_DOMAINS = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|libero|virgilio|proton|protonmail)\./i;

  // ==========================================================================
  // Saved state. Everything lives in this browser's localStorage, never on a server.
  // ==========================================================================
  var KEY = 'gigome.demo.v2';
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function seed() {
    return {
      session: null,            // null | 'student' | 'employer'
      profile: null, draft: null, verify: null,
      apps: [], saved: [], searches: [], follows: [], notes: [], myReviews: [],
      reviews: clone(SEED_REVIEWS), verified: {},
      employer: clone(DEMO_EMPLOYER), listings: clone(SEED_LISTINGS), applicants: clone(SEED_APPLICANTS), past: clone(SEED_PAST),
      posted: [], queue: clone(SEED_QUEUE),
      reports: [{ title: 'Promoter, nightlife events', reason: 'Pay unclear' }, { title: 'Delivery rider', reason: 'Italian required' }],
      feedback: [{ text: '"Would love a filter for roles near where I live."', who: 'Student' }, { text: '"Posting took five minutes."', who: 'Employer' }],
      kpi: { students: 64, companies: 7 }
    };
  }
  var db = (function () {
    var fresh = seed();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = JSON.parse(raw); Object.keys(fresh).forEach(function (k) { if (!(k in d)) d[k] = fresh[k]; }); return d; }
    } catch (e) { /* storage blocked: run with the seed only */ }
    return fresh;
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }

  // ==========================================================================
  // Helpers
  // ==========================================================================
  var $ = function (id) { return document.getElementById(id); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  var postedLabel = function (d) { return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d + ' days ago'; };
  var slug = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fmtDate = function (iso) { var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0] : iso; };
  var initials = function (n) { return String(n || '?').trim().split(/\s+/).map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase(); };
  var shortName = function (n) { var p = String(n).trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : p[0]; };
  var verifiedIcon = '<svg class="icon" role="img" aria-label="Verified employer"><use href="#i-verified"/></svg>';
  var starsTxt = function (n) { var r = Math.round(n); return '<span class="stars-txt" aria-hidden="true">' + '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r) + '</span>'; };

  function allJobs() { return JOBS.concat(db.posted); }
  function findJob(id) { return allJobs().filter(function (j) { return j.id === id; })[0]; }
  function areaOf(name) { var j = allJobs().filter(function (x) { return x.company === name && x.mode !== 'Remote'; })[0]; return j ? j.area : 'Remote'; }
  function allCompanies() {
    var names = [];
    allJobs().forEach(function (j) { if (names.indexOf(j.company) === -1) names.push(j.company); });
    if (db.employer && names.indexOf(db.employer.name) === -1) names.push(db.employer.name);
    return names.sort();
  }
  function companyBySlug(s) { return allCompanies().filter(function (n) { return slug(n) === s; })[0]; }
  function companyInfo(name) {
    var base = COMPANY[name] || {};
    var info = { name: name, sector: base.sector || '', private: !!base.private, desc: base.desc || name + ' hires students through GigoMe.', site: base.site || '', area: areaOf(name), showLocation: true, verified: base.verified !== false, status: '' };
    if (db.verified[name]) info.verified = true;
    var e = db.employer;
    if (e && e.name === name) {
      info.private = e.type === 'private'; info.sector = info.private ? '' : e.sector; info.desc = e.desc || info.desc; info.site = info.private ? '' : e.site;
      info.area = e.area || info.area; info.showLocation = e.showLocation !== false; info.verified = e.verify === 'verified';
      info.email = e.email; info.phone = e.phone; info.contactName = e.contactName; info.status = e.verify;
    }
    if (!info.status) info.status = info.verified ? 'verified' : 'none';
    return info;
  }
  function kindLabel(info) { return info.private ? 'Private employer' : info.sector; }
  function ratingOf(name) {
    var r = db.reviews[name] || [];
    if (!r.length) return null;
    return { avg: r.reduce(function (s, x) { return s + x.rating; }, 0) / r.length, n: r.length };
  }
  function ratingHTML(name, long) {
    var r = ratingOf(name);
    if (!r) return long ? '<span class="muted">No reviews yet</span>' : '';
    return '<span class="rating" aria-label="Rated ' + r.avg.toFixed(1) + ' out of 5 from ' + plural(r.n, 'review', 'reviews') + '">' + (long ? starsTxt(r.avg) : '★') + ' ' + r.avg.toFixed(1) + (long ? ' <span class="muted">(' + plural(r.n, 'review', 'reviews') + ')</span>' : '') + '</span>';
  }
  function metroBadges(j) {
    return (j.metro || []).map(function (m) { return '<span class="metro" title="Metro line ' + m + '" aria-label="Metro line ' + m + '">' + m + '</span>'; }).join('');
  }
  function place(j) {
    if (j.mode === 'Remote') return 'Remote';
    if (!companyInfo(j.company).showLocation) return 'Milan, area on request';
    return '<span class="place">' + esc(j.area) + (j.metro && j.metro.length ? ' ' + metroBadges(j) : '') + '</span>';
  }
  // Does a role fit a student's availability? Flexible roles fit anyone.
  var AVAIL_FIT = { 'Weekends': function (j) { return j.when.indexOf('Weekends') !== -1; }, 'Evenings': function (j) { return j.when.indexOf('Evenings') !== -1; },
    'Weekday mornings': function (j) { return j.when.indexOf('Weekdays') !== -1; }, 'Remote': function (j) { return j.mode === 'Remote'; } };
  function fitsAvail(j, avail) {
    if (!avail || !avail.length) return false;
    return j.when.indexOf('Flexible') !== -1 || avail.some(function (a) { return AVAIL_FIT[a] && AVAIL_FIT[a](j); });
  }
  // One plain reason for the top results. "Your" only when it is really about the signed-in student.
  function reason(j) {
    var avail = db.session === 'student' && db.profile ? db.profile.avail || [] : [];
    if (avail.indexOf('Weekends') !== -1 && AVAIL_FIT.Weekends(j)) return 'Fits your weekend availability';
    if (avail.indexOf('Evenings') !== -1 && AVAIL_FIT.Evenings(j)) return 'Fits your evening availability';
    if (avail.indexOf('Weekday mornings') !== -1 && AVAIL_FIT['Weekday mornings'](j)) return 'Fits your weekday availability';
    if (avail.indexOf('Remote') !== -1 && j.mode === 'Remote') return 'Remote, as you asked';
    if (j.rate >= HIGH_PAY) return 'Above-average pay';
    if (j.when.indexOf('Flexible') !== -1) return 'Flexible hours';
    if (!avail.length && j.when.indexOf('Weekends') !== -1) return 'Weekend shifts, around lectures';
    if (!avail.length && j.when.indexOf('Evenings') !== -1) return 'Evening hours, around lectures';
    return j.lang === 'en' ? 'No Italian needed' : 'Highly rated match';
  }
  function row(j, withReason) {
    var info = companyInfo(j.company);
    var tags = (j.posted === 0 ? '<span class="tag tag-new">New</span>' : '') + (j.lang === 'en' ? '' : '<span class="tag">Basic Italian</span>');
    var meta = [TYPE[j.cat], place(j), esc(j.when.join(', '))].concat(info.private ? ['Private employer'] : []).join('<span class="sep" aria-hidden="true">·</span>');
    return '<li><a class="role-row" href="#job/' + esc(j.id) + '">' +
      '<div><div class="role-l1"><span class="role-title">' + esc(j.title) + '</span>' +
        '<span class="role-co"><span class="verified">' + esc(j.company) + (info.verified ? verifiedIcon : '') + '</span></span>' + ratingHTML(j.company) + tags + '</div>' +
        '<div class="role-meta">' + meta + '</div>' +
        (withReason ? '<div class="role-reason">' + reason(j) + '</div>' : '') + '</div>' +
      '<div class="role-pay"><span class="pay tnum">' + esc(j.pay) + '</span><span class="posted tnum">' + postedLabel(j.posted) + '</span></div>' +
      '</a></li>';
  }
  // Rough hourly equivalent for pay typed by an employer, used for the pay filter.
  function hourlyRate(pay) {
    var m = String(pay).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    if (!m) return 0;
    var n = +m[1], p = pay.toLowerCase();
    if (/month/.test(p)) return Math.round(n / 80 * 10) / 10;     // student internships: about 20 h a week
    if (/project/.test(p)) return Math.round(n / 24 * 10) / 10;
    if (/day/.test(p)) return Math.round(n / 8 * 10) / 10;
    if (/evening|tour|shift/.test(p)) return Math.round(n / 4 * 10) / 10;
    return n;
  }

  // ---------- Toast ----------
  var toastTimer;
  function toast(html) {
    var t = $('toast');
    t.innerHTML = html; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 5000);
  }

  // ---------- Modal: one dialog reused for every form ----------
  var modal = $('modal'), modalForm = $('modal-form'), modalSubmit = null;
  function openModal(o) {
    $('modal-title').textContent = o.title;
    $('modal-body').innerHTML = o.body;
    var foot = '';
    if (o.cancel !== false) foot += '<button type="button" class="btn btn-secondary" data-close>' + esc(o.cancel || 'Cancel') + '</button>';
    (o.extra || []).forEach(function (b, i) { foot += '<button type="button" class="btn btn-secondary" data-extra="' + i + '">' + esc(b.label) + '</button>'; });
    if (o.submit) foot += '<button type="submit" class="btn btn-primary">' + esc(o.submit) + '</button>';
    $('modal-foot').innerHTML = foot;
    $('modal-foot').hidden = !foot;
    modalSubmit = o;
    if (modal.open) modal.close();
    modal.showModal();
    var first = $('modal-body').querySelector('input:not([type=hidden]), textarea, select') || $('modal-foot').querySelector('[type=submit]') || $('modal-foot').querySelector('button');
    if (first) first.focus();
    if (o.onOpen) o.onOpen($('modal-body'));
  }
  function closeModal() { if (modal.open) modal.close(); }
  modalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!modalSubmit || !modalSubmit.onSubmit) { closeModal(); return; }
    // Close first: onSubmit may open the next dialog (sign in, then apply).
    var o = modalSubmit, fd = new FormData(modalForm);
    closeModal(); o.onSubmit(fd, modalForm);
  });
  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    var x = e.target.closest('[data-extra]');
    if (x && modalSubmit && modalSubmit.extra) { var o = modalSubmit, fd = new FormData(modalForm); closeModal(); o.extra[+x.dataset.extra].onClick(fd); }
  });

  // ==========================================================================
  // Accounts (demo: any email and password sign in to the sample accounts)
  // ==========================================================================
  function signIn(kind) {
    if (kind === 'student') {
      if (!db.profile) {
        db.profile = clone(DEMO_PROFILE);
        db.verify = { email: DEMO_PROFILE.studentEmail, verified: true };
        if (!db.apps.length) db.apps = [
          { job: 'w3', via: 'site', status: 'Accepted', date: '2026-10-02' },
          { job: 'i2', via: 'email', status: 'Rejected', date: '2026-10-10' },
          { job: 't2', via: 'email', status: 'Applied', date: '2026-10-28' }
        ];
        if (!db.searches.length) db.searches = [{ id: 's1', name: 'Weekend roles', state: { q: '', area: '', cats: [], minPay: 0, when: ['Weekends'], modes: [], englishOnly: true, sort: 'match' }, alerts: true }];
        if (!db.follows.length) db.follows = ['Navigli Bike Tours'];
        if (!db.notes.length) db.notes = [{ text: 'New role matches "Weekend roles": Weekend barista at Nebbia Coffee Bar', href: '#job/w1', date: todayISO() }];
      }
      db.session = 'student';
    } else {
      if (!db.employer) { db.employer = clone(DEMO_EMPLOYER); db.listings = clone(SEED_LISTINGS); db.applicants = clone(SEED_APPLICANTS); db.past = clone(SEED_PAST); }
      db.session = 'employer';
    }
    save(); renderAuth();
  }
  function signOut() {
    db.session = null; save(); renderAuth(); toast('Signed out.');
    route();
  }
  function openSignIn(kind, then) {
    kind = kind || 'student';
    openModal({
      title: 'Sign in',
      body: (then ? '<p>Sign in to a student account to do this.</p>' : '') +
        '<fieldset><legend>I am</legend><div class="radio-row">' +
        '<label class="check"><input type="radio" name="kind" value="student"' + (kind === 'student' ? ' checked' : '') + '> A student</label>' +
        '<label class="check"><input type="radio" name="kind" value="employer"' + (kind === 'employer' ? ' checked' : '') + '> An employer</label></div></fieldset>' +
        '<label class="field">Email<input class="input" type="email" name="email" required autocomplete="email"></label>' +
        '<label class="field">Password<input class="input" type="password" name="pw" required autocomplete="current-password"></label>' +
        '<p class="note">Demo: any email and password sign you in to the sample account. Or use "Demo account".</p>' +
        '<p class="hint">New here? <a href="#signup" data-close>Create a student profile</a> or <a href="#company" data-close>an employer account</a>.</p>',
      extra: [{ label: 'Demo account', onClick: function (fd) { finish(fd.get('kind')); } }],
      submit: 'Sign in',
      onSubmit: function (fd) { finish(fd.get('kind')); }
    });
    function finish(k) {
      signIn(k);
      toast('Signed in as ' + esc(k === 'student' ? db.profile.name : db.employer.name) + '.');
      if (then && k === 'student') then();
      else if (!then) go(k === 'student' ? '#me' : '#company');
      else route();
    }
  }
  // Run fn as a signed-in student, asking to sign in first if needed.
  function needStudent(fn) {
    if (db.session === 'student' && db.profile) fn();
    else openSignIn('student', function () { fn(); refresh(); });
  }
  function renderAuth() {
    var s = db.session;
    var unread = s === 'student' ? db.notes.filter(function (n) { return !n.read; }).length : 0;
    $('auth-actions').innerHTML = s
      ? '<button type="button" class="btn btn-tertiary btn-sm signin" data-signout>Sign out</button><a class="btn btn-primary btn-sm" href="' + (s === 'student' ? '#me' : '#company') + '">' + (s === 'student' ? 'My dashboard' + (unread ? ' (' + unread + ')' : '') : 'Dashboard') + '</a>'
      : '<button type="button" class="btn btn-tertiary btn-sm signin" data-signin>Sign in</button><a class="btn btn-primary btn-sm" href="#signup">Create profile</a>';
    $('menu-auth').innerHTML = s ? '<button type="button" data-signout>Sign out</button>' : '<button type="button" data-signin>Sign in</button>';
  }

  // Alerts for the (single) demo student
  function note(text, href) { db.notes.unshift({ text: text, href: href, date: todayISO() }); }

  // ==========================================================================
  // Jobs: state, filters, results
  // ==========================================================================
  function freshState() { return { q: '', company: '', area: '', cats: [], minPay: 0, when: [], modes: [], englishOnly: false, sort: 'match' }; }
  var state = freshState();
  var form = $('filters');

  function renderTypeFilters() {
    $('type-filters').innerHTML = TYPES.map(function (t) {
      var n = allJobs().filter(function (j) { return j.cat === t[0]; }).length;
      return '<label class="check"><input type="checkbox" name="cat" value="' + t[0] + '"> ' + t[1] + '<span class="count tnum">' + n + '</span></label>';
    }).join('');
  }

  function passes(j, s) {
    var q = (s.q || '').toLowerCase().trim();
    return (!s.company || j.company === s.company) &&
      (!s.cats.length || s.cats.indexOf(j.cat) !== -1) &&
      j.rate >= s.minPay &&
      (!s.area || j.area === s.area) &&
      (!s.when.length || j.when.some(function (w) { return s.when.indexOf(w) !== -1; })) &&
      (!s.modes.length || s.modes.indexOf(j.mode) !== -1) &&
      (!s.englishOnly || j.lang === 'en') &&
      (!q || (j.title + ' ' + j.company + ' ' + kindLabel(companyInfo(j.company)) + ' ' + TYPE[j.cat] + ' ' + j.area).toLowerCase().indexOf(q) !== -1);
  }
  function filtered(s) {
    var by = { match: function (a, b) { return b.match - a.match; }, pay: function (a, b) { return b.rate - a.rate; }, new: function (a, b) { return a.posted - b.posted || b.match - a.match; } }[s.sort];
    return allJobs().filter(function (j) { return passes(j, s); }).sort(by);
  }
  // Each active filter as a removable item: label + how to remove it from a state.
  function activeFilters(s) {
    var out = [];
    if (s.q) out.push({ label: 'Search: ' + s.q, drop: function (t) { t.q = ''; } });
    if (s.company) out.push({ label: 'Employer: ' + s.company, drop: function (t) { t.company = ''; } });
    if (s.area) out.push({ label: 'Area: ' + s.area, drop: function (t) { t.area = ''; } });
    s.cats.forEach(function (c) { out.push({ label: TYPE[c], drop: function (t) { t.cats = t.cats.filter(function (x) { return x !== c; }); } }); });
    if (s.minPay) out.push({ label: 'At least €' + s.minPay + '/h', drop: function (t) { t.minPay = 0; } });
    s.when.forEach(function (w) { out.push({ label: w, drop: function (t) { t.when = t.when.filter(function (x) { return x !== w; }); } }); });
    s.modes.forEach(function (m) { out.push({ label: m, drop: function (t) { t.modes = t.modes.filter(function (x) { return x !== m; }); } }); });
    if (s.englishOnly) out.push({ label: 'No Italian needed', drop: function (t) { t.englishOnly = false; } });
    return out;
  }
  function summary(s) { var a = activeFilters(s).map(function (f) { return f.label; }); return a.length ? a.join(', ') : 'All roles'; }

  function syncControls() {
    each(form.querySelectorAll('input[name=cat]'), function (el) { el.checked = state.cats.indexOf(el.value) !== -1; });
    each(form.querySelectorAll('input[name=when]'), function (el) { el.checked = state.when.indexOf(el.value) !== -1; });
    each(form.querySelectorAll('input[name=mode]'), function (el) { el.checked = state.modes.indexOf(el.value) !== -1; });
    $('english-only').checked = state.englishOnly;
    $('min-pay').value = state.minPay;
    $('min-pay-label').textContent = state.minPay ? '€' + state.minPay + '+/h' : 'Any';
    $('sort').value = state.sort;
    if ($('job-search').value !== state.q) $('job-search').value = state.q;
  }

  function render() {
    syncControls();
    var list = filtered(state);
    var active = activeFilters(state);
    $('result-count').textContent = plural(list.length, 'role', 'roles');
    var mine = db.session === 'student' ? db.searches.length : 0;
    $('saved-link').hidden = !mine;
    $('saved-link').textContent = 'Your saved searches (' + mine + ')';
    $('filters-btn').textContent = active.length ? 'Filters (' + active.length + ')' : 'Filters';
    $('drawer-apply').textContent = 'Show ' + plural(list.length, 'role', 'roles');
    $('active-chips').innerHTML = active.map(function (f, i) {
      return '<span class="chip">' + esc(f.label) + '<button type="button" data-drop="' + i + '" aria-label="Remove filter: ' + esc(f.label) + '">&times;</button></span>';
    }).join('') + (active.length ? '<button type="button" class="btn btn-tertiary btn-sm" data-clear>Clear all</button>' : '');
    $('active-chips').hidden = !active.length;
    $('results').innerHTML = list.map(function (j, i) { return row(j, state.sort === 'match' && i < 3); }).join('');
    $('results').hidden = !list.length;

    var empty = $('empty');
    empty.hidden = list.length > 0;
    if (!list.length) {
      // Find the single filter whose removal brings back the most roles.
      var best = null;
      active.forEach(function (f, i) {
        var t = clone(state); f.drop(t);
        var n = filtered(t).length;
        if (!best || n > best.n) best = { i: i, n: n, label: f.label };
      });
      empty.innerHTML = '<p><strong>No roles match these filters.</strong></p>' +
        (best && best.n ? '<p class="muted">"' + esc(best.label) + '" excludes the most. Removing it shows ' + plural(best.n, 'role', 'roles') + '.</p>' : '') +
        '<p class="muted">Or <button type="button" class="btn-link" data-save-search>save this search</button> and get an email when a matching role is posted.</p>' +
        '<div class="btns">' + (best && best.n ? '<button type="button" class="btn btn-primary btn-sm" data-drop="' + best.i + '">Remove "' + esc(best.label) + '"</button>' : '') +
        '<button type="button" class="btn btn-secondary btn-sm" data-clear>Clear all filters</button></div>';
    }
  }

  function dropFilter(i) { var f = activeFilters(state)[i]; if (f) { f.drop(state); render(); } }
  $('page-jobs').addEventListener('click', function (e) {
    var d = e.target.closest('[data-drop]');
    if (d) { dropFilter(+d.dataset.drop); return; }
    if (e.target.closest('[data-clear]')) { var keepSort = state.sort; state = freshState(); state.sort = keepSort; render(); return; }
    if (e.target.closest('[data-save-search]')) saveSearch();
  });
  form.addEventListener('change', function (e) {
    var t = e.target;
    var toggle = function (arr, v, on) { var i = arr.indexOf(v); if (on && i === -1) arr.push(v); if (!on && i !== -1) arr.splice(i, 1); };
    if (t.name === 'cat') toggle(state.cats, t.value, t.checked);
    else if (t.name === 'when') toggle(state.when, t.value, t.checked);
    else if (t.name === 'mode') toggle(state.modes, t.value, t.checked);
    else if (t.id === 'english-only') state.englishOnly = t.checked;
    else return;
    render();
  });
  $('min-pay').addEventListener('input', function (e) { state.minPay = +e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('job-search').addEventListener('input', function (e) { state.q = e.target.value; render(); });

  // Saved searches with email alerts
  function saveSearch() {
    needStudent(function () {
      var label = summary(state);
      openModal({
        title: 'Save this search',
        body: '<label class="field">Name<input class="input" name="name" required maxlength="60" value="' + esc(label) + '"></label>' +
          '<p class="hint">Filters: ' + esc(label) + '</p>' +
          '<label class="check"><input type="checkbox" name="alerts" checked> Email me when a new role matches</label>' +
          '<p class="hint">Alerts go to ' + esc(db.profile.email) + '. Manage saved searches in your dashboard.</p>',
        submit: 'Save search',
        onSubmit: function (fd) {
          var s = clone(state); s.sort = 'match';
          db.searches.push({ id: 's' + Date.now(), name: fd.get('name').trim() || label, state: s, alerts: !!fd.get('alerts') });
          save(); render();
          toast('Search saved. <a href="#me/searches">See your saved searches</a>');
        }
      });
    });
  }
  $('save-search').addEventListener('click', saveSearch);

  // Filters drawer (under 900px): the same form moves into a modal <dialog>,
  // which traps focus and closes on Escape.
  var drawer = $('filter-drawer');
  $('filters-btn').addEventListener('click', function () { $('drawer-body').appendChild(form); render(); drawer.showModal(); });
  $('drawer-close').addEventListener('click', function () { drawer.close(); });
  $('drawer-apply').addEventListener('click', function () { drawer.close(); });
  drawer.addEventListener('close', function () { $('filters-slot').appendChild(form); $('filters-btn').focus(); });
  drawer.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(drawer.querySelectorAll('button, input, select, a[href]'), function (el) { return !el.disabled && el.offsetParent; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Deep links: #jobs/<type> pre-selects that type; #jobs/high and #jobs/remote map to pay and work mode.
  function applyDeepLink(key) {
    state = freshState();
    if (TYPE[key]) state.cats = [key];
    else if (key === 'high') { state.minPay = HIGH_PAY; state.sort = 'pay'; }
    else if (key === 'remote') state.modes = ['Remote'];
  }

  // ==========================================================================
  // Home
  // ==========================================================================
  var areas = JOBS.map(function (j) { return j.area; }).filter(function (a, i, arr) { return a !== 'Remote' && arr.indexOf(a) === i; }).sort();
  $('home-area').innerHTML += areas.concat(['Remote']).map(function (a) { return '<option>' + esc(a) + '</option>'; }).join('');
  $('area-list').innerHTML = areas.concat(['Remote']).map(function (a) { return '<option value="' + esc(a) + '">'; }).join('');
  $('home-search').addEventListener('submit', function (e) {
    e.preventDefault();
    state = freshState();
    state.q = $('home-q').value.trim();
    state.area = $('home-area').value;
    if (state.area === 'Remote') { state.area = ''; state.modes = ['Remote']; }
    state.englishOnly = $('home-english').checked;
    if (location.hash === '#jobs') { route(); } else { location.hash = '#jobs'; }
  });
  function renderHome() {
    var newest = allJobs().slice().sort(function (a, b) { return a.posted - b.posted || b.match - a.match; }).slice(0, 5);
    $('newest').innerHTML = newest.map(function (j) { return row(j, false); }).join('');
    $('see-all').textContent = 'See all ' + allJobs().length + ' roles';
    map.renderPins();
  }

  // ---------- Home: map ----------
  var map = (function initMap() {
    var vp = $('map-viewport'), stage = $('map-stage'), layer = $('map-pins'), tip = $('map-tip'), wrap = $('map-wrap'), hint = $('map-hint');
    var SIZE = 808, OFF = 17, CENTER = [500, 480];

    function placeAt(el, pt) { el.style.left = (pt[0] - OFF) + 'px'; el.style.top = (pt[1] - OFF) + 'px'; }
    function renderPins() {
      var groups = {}, remote = 0, onMap = 0;
      allJobs().forEach(function (j) {
        // Remote roles, companies without a map position, and employers who hide their area stay off the map.
        if (j.mode === 'Remote' || !POS[j.company] || !companyInfo(j.company).showLocation) { remote += j.mode === 'Remote' ? 1 : 0; return; }
        onMap++;
        (groups[j.company] = groups[j.company] || []).push(j);
      });
      $('map-total').textContent = plural(onMap, 'role', 'roles');
      $('map-remote').textContent = remote;
      layer.innerHTML = '';
      Object.keys(groups).forEach(function (name) {
        var jobs = groups[name];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-pin';
        btn.textContent = jobs.length;
        btn.setAttribute('aria-label', name + ', ' + plural(jobs.length, 'open role', 'open roles') + '. Show in the role list.');
        var html = '<strong>' + esc(name) + '</strong><span class="tip-area">' + esc(jobs[0].area) + '</span><ul>' +
          jobs.map(function (j) { return '<li>' + esc(j.title) + '<span>' + esc(j.pay) + ', ' + esc(j.when.join(', ')) + '</span><span>Posted ' + postedLabel(j.posted).toLowerCase() + '</span></li>'; }).join('') + '</ul>';
        var show = function () { showTip(html, btn); }, hide = function () { hideTip(btn); };
        btn.addEventListener('mouseenter', show); btn.addEventListener('focus', show);
        btn.addEventListener('mouseleave', hide); btn.addEventListener('blur', hide);
        btn.addEventListener('click', function () { state = freshState(); state.company = name; location.hash = '#jobs'; });
        placeAt(btn, POS[name]);
        layer.appendChild(btn);
      });
    }

    function showTip(html, el) {
      tip.innerHTML = html;
      el.classList.add('on');
      var wr = wrap.getBoundingClientRect(), pr = el.getBoundingClientRect();
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = Math.min(Math.max(pr.left + pr.width / 2 - wr.left - tw / 2, 8), wr.width - tw - 8);
      var top = pr.top - wr.top - th - 10;
      if (top < 0) top = pr.bottom - wr.top + 10;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      tip.classList.add('show');
    }
    function hideTip(el) { tip.classList.remove('show'); if (el) el.classList.remove('on'); }

    // Pan and zoom. Pins live inside the stage and counter-scale, so they move with the map.
    var s = 0, tx = 0, ty = 0, minS = 0, maxS = 0;
    function apply(animate) {
      var w = vp.clientWidth, h = vp.clientHeight;
      s = Math.min(Math.max(s, minS), maxS);
      tx = Math.min(0, Math.max(w - SIZE * s, tx));
      ty = Math.min(0, Math.max(h - SIZE * s, ty));
      stage.classList.toggle('animate', !!animate);
      stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      stage.style.setProperty('--inv', (1 / s).toFixed(4));
    }
    function fit(animate) {
      var w = vp.clientWidth, h = vp.clientHeight;
      if (!w || !h) return false;
      minS = Math.max(w / SIZE, h / SIZE); maxS = minS * 3.5; s = minS * 1.12;
      tx = w / 2 - (CENTER[0] - OFF) * s; ty = h / 2 - (CENTER[1] - OFF) * s;
      apply(animate); return true;
    }
    function zoomAt(f, cx, cy, animate) {
      var ns = Math.min(Math.max(s * f, minS), maxS), k = ns / s;
      tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; s = ns;
      hideTip(); apply(animate);
    }
    function local(e) { var r = vp.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    var drag = null, wheelOn = false;
    vp.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.map-pin, .map-controls')) return;
      drag = { x: e.clientX, y: e.clientY }; vp.classList.add('dragging'); vp.setPointerCapture(e.pointerId); hideTip();
    });
    vp.addEventListener('pointermove', function (e) {
      if (!drag) return;
      tx += e.clientX - drag.x; ty += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; apply(false);
    });
    var endDrag = function () { drag = null; vp.classList.remove('dragging'); };
    vp.addEventListener('pointerup', endDrag); vp.addEventListener('pointercancel', endDrag);
    vp.addEventListener('click', function (e) { if (e.target.closest('.map-pin, .map-controls')) return; wheelOn = true; hint.classList.add('gone'); });
    vp.addEventListener('mouseleave', function () { wheelOn = false; });
    vp.addEventListener('wheel', function (e) {
      if (!wheelOn) return;
      e.preventDefault(); var p = local(e); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p[0], p[1], false);
    }, { passive: false });
    vp.addEventListener('dblclick', function (e) { if (e.target.closest('.map-pin, .map-controls')) return; var p = local(e); zoomAt(1.6, p[0], p[1], true); });
    $('map-zoom-in').addEventListener('click', function () { zoomAt(1.4, vp.clientWidth / 2, vp.clientHeight / 2, true); });
    $('map-zoom-out').addEventListener('click', function () { zoomAt(1 / 1.4, vp.clientWidth / 2, vp.clientHeight / 2, true); });
    $('map-reset').addEventListener('click', function () { hideTip(); fit(true); });
    on(window, 'resize', function () {
      if (!minS) { fit(false); return; }
      var ratio = s / minS;
      minS = Math.max(vp.clientWidth / SIZE, vp.clientHeight / SIZE); maxS = minS * 3.5; s = minS * ratio; apply(false);
    });
    setTimeout(function () { hint.classList.add('gone'); }, 5000);
    return { renderPins: renderPins, refresh: function () { if (!minS) fit(false); else apply(false); } };
  })();

  // ==========================================================================
  // Role detail (#job/<id>)
  // ==========================================================================
  var TASKS = {
    parttime: ['Work regular shifts agreed with the employer.', 'Serve customers and keep the space tidy.', 'Ask the team for training on anything new.'],
    day: ['Arrive on time and check in with the organiser.', 'Welcome and help guests in English.', 'Help set up before and pack down after.'],
    tutoring: ['Plan short sessions around the learner\'s needs.', 'Explain ideas clearly in English.', 'Give a short progress update every month.'],
    project: ['Agree the brief and deadline at the start.', 'Deliver a short, finished piece of work.', 'Present what you found in a final call.'],
    internship: ['Work with a small team on real projects.', 'Join weekly check-ins with your manager.', 'Agree a learning plan in your first week.']
  };
  function detailOf(j) {
    var d = DETAIL[j.id] || {};
    var where = j.mode === 'Remote' ? ' that you can do from anywhere' : ' in ' + j.area;
    return {
      schedule: d.schedule || j.when.join(', '),
      start: d.start,
      about: d.about || j.desc || (j.company + ' is looking for a student for a ' + TYPE[j.cat].toLowerCase() + ' role' + where + '. ' + (j.lang === 'en' ? 'English is enough: no Italian needed.' : 'Basic Italian helps for this role.') + ' Pay is ' + j.pay + '.'),
      tasks: d.tasks || TASKS[j.cat],
      good: d.good || [
        'Length: ' + j.duration.toLowerCase() + '.',
        j.mode === 'Hybrid' ? 'Part of the work can be done remotely.' : j.mode === 'Remote' ? 'Fully remote. You need your own laptop.' : 'On-site.',
        'Contract and pay are agreed directly with the employer.'
      ]
    };
  }
  function appFor(jobId) { return db.session === 'student' ? db.apps.filter(function (a) { return a.job === jobId; })[0] : null; }
  function statusTag(s) { return '<span class="tag tag-' + s.toLowerCase() + '">' + s + '</span>'; }

  function renderJob(id) {
    var j = findJob(id) || findJob('w1');
    var info = companyInfo(j.company), d = detailOf(j), app = appFor(j.id), saved = db.saved.indexOf(j.id) !== -1;
    var following = db.follows.indexOf(j.company) !== -1;
    var tags = (j.posted === 0 ? '<span class="tag tag-new">New</span>' : '') + '<span class="tag">' + TYPE[j.cat] + '</span><span class="tag">' + (j.lang === 'en' ? 'No Italian needed' : 'Basic Italian') + '</span>' + (j.mode !== 'On-site' ? '<span class="tag">' + j.mode + '</span>' : '');
    var applyBox = app
      ? '<div class="applied"><strong>You applied on ' + fmtDate(app.date) + '</strong><p>Status: ' + statusTag(app.status) + '</p><p><a href="#me">Track it in your dashboard</a></p></div>'
      : '<button type="button" class="btn btn-primary" data-apply="site">Apply on company site <svg class="icon" aria-hidden="true"><use href="#i-ext"/></svg></button>' +
        '<button type="button" class="btn btn-secondary" data-apply="email">Email employer</button>';
    $('job-root').innerHTML =
      '<a class="back" href="#jobs"><svg class="icon" aria-hidden="true"><use href="#i-back"/></svg>All roles</a>' +
      '<div class="detail"><article>' +
        '<h1 class="page-title">' + esc(j.title) + '</h1>' +
        '<p class="detail-co"><span class="verified"><a href="#employer/' + slug(j.company) + '">' + esc(j.company) + '</a>' + (info.verified ? verifiedIcon : '') + '</span>' + ratingHTML(j.company) + '</p>' +
        '<div class="tags">' + tags + '</div>' +
        '<dl class="facts">' +
          '<div><dt>Pay</dt><dd class="tnum">' + esc(j.pay) + '</dd></div>' +
          '<div><dt>Schedule</dt><dd>' + esc(d.schedule) + '</dd></div>' +
          '<div><dt>Location</dt><dd>' + place(j) + '</dd></div>' +
          '<div><dt>' + (d.start ? 'Start' : 'Length') + '</dt><dd>' + esc(d.start || j.duration) + '</dd></div>' +
        '</dl>' +
        '<div class="prose-role">' +
          '<h2>About the role</h2><p>' + esc(d.about) + '</p>' +
          '<h2>What you\'ll do</h2><ul>' + d.tasks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
          '<h2>Good to know</h2><ul>' + d.good.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '</div>' +
      '</article>' +
      '<aside aria-label="Apply"><div class="apply">' + applyBox +
        '<button type="button" class="btn btn-tertiary btn-sm save" data-save aria-pressed="' + saved + '">' + (saved ? 'Saved' : 'Save') + '</button>' +
        '<p class="apply-note">Applications go straight to the employer. Track them in your dashboard.</p>' +
        '<div class="employer">' +
          '<strong>' + esc(j.company) + '</strong>' +
          '<p class="muted">' + esc([kindLabel(info), info.showLocation ? info.area : 'Area on request'].filter(Boolean).join(', ')) + '</p>' +
          '<p>' + (info.verified ? '<span class="verified"><svg class="icon" aria-hidden="true"><use href="#i-verified"/></svg>Reviewed by the GigoMe team</span>' : '<span class="muted">Not verified by the GigoMe team yet</span>') + '</p>' +
          '<p>' + ratingHTML(j.company, true) + '</p>' +
          '<p class="btn-row"><a href="#employer/' + slug(j.company) + '">View employer</a><button type="button" class="btn btn-secondary btn-sm" data-follow="' + esc(j.company) + '" aria-pressed="' + following + '">' + (following ? 'Following' : 'Follow') + '</button></p>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="report" data-report><svg class="icon" aria-hidden="true"><use href="#i-flag"/></svg>Report this role</button>' +
      '</aside></div>';
    $('job-root').dataset.job = j.id;
  }
  $('job-root').addEventListener('click', function (e) {
    var j = findJob($('job-root').dataset.job);
    if (!j) return;
    var a = e.target.closest('[data-apply]');
    if (a) { startApply(j, a.dataset.apply); return; }
    if (e.target.closest('[data-save]')) { needStudent(function () { toggleSaved(j.id); renderJob(j.id); }); return; }
    if (e.target.closest('[data-report]')) { openReport(j); }
  });

  function startApply(j, via) {
    needStudent(function () {
      if (appFor(j.id)) { renderJob(j.id); return; }
      var info = companyInfo(j.company), p = db.profile;
      if (via === 'site') {
        openModal({
          title: 'Apply on ' + j.company + "'s site",
          body: '<p>This opens the employer\'s own application page in a new tab. In this demo there is no real page, so nothing opens.</p>' +
            '<p>We\'ll add the role to your applications so you can track it. Update the status when you hear back.</p>',
          submit: 'Continue to apply',
          onSubmit: function () { addApp(j, 'site'); }
        });
      } else {
        var msg = 'Hi,\n\nI\'d like to apply for the ' + j.title + ' role. I\'m a ' + (p.programme || 'university') + ' student' + (p.avail && p.avail.length ? ' and I\'m available ' + p.avail.join(', ').toLowerCase() : '') + '.\n\nBest,\n' + p.name;
        openModal({
          title: 'Email ' + j.company,
          body: '<p class="hint">To: ' + esc(info.email || 'the employer') + '. Sent from your contact email, ' + esc(p.email) + '.</p>' +
            '<label class="field">Subject<input class="input" name="subject" required value="' + esc('Application: ' + j.title) + '"></label>' +
            '<label class="field">Message<textarea class="textarea" name="msg" rows="7" required>' + esc(msg) + '</textarea></label>' +
            '<label class="check"><input type="checkbox" name="link" checked> Include a link to my GigoMe profile</label>',
          submit: 'Send email',
          onSubmit: function () { addApp(j, 'email'); }
        });
      }
    });
  }
  function addApp(j, via) {
    db.apps.unshift({ job: j.id, via: via, status: 'Applied', date: todayISO() });
    save(); renderAuth();
    toast(via === 'email' ? 'Email sent. Added to <a href="#me">your applications</a>.' : 'Added to <a href="#me">your applications</a>. Good luck!');
    renderJob(j.id);
  }
  function toggleSaved(id) {
    var i = db.saved.indexOf(id);
    if (i === -1) { db.saved.push(id); toast('Saved. Find it in <a href="#me/saved">your dashboard</a>.'); } else { db.saved.splice(i, 1); toast('Removed from saved roles.'); }
    save();
  }
  function toggleFollow(name) {
    needStudent(function () {
      var i = db.follows.indexOf(name);
      if (i === -1) { db.follows.push(name); toast('Following ' + esc(name) + '. You\'ll get an alert when they post a new role.'); }
      else { db.follows.splice(i, 1); toast('Unfollowed ' + esc(name) + '.'); }
      save(); refresh();
    });
  }
  function openReport(j) {
    var reasons = ['Pay is unclear or too low', 'Italian is actually required', 'Looks like a scam', 'The role is no longer available', 'Something else'];
    openModal({
      title: 'Report this role',
      body: '<p>' + esc(j.title) + ', ' + esc(j.company) + '</p>' +
        '<fieldset><legend>What\'s wrong?</legend>' + reasons.map(function (r, i) { return '<label class="check"><input type="radio" name="reason" value="' + esc(r) + '"' + (i === 0 ? ' required' : '') + '> ' + esc(r) + '</label>'; }).join('') + '</fieldset>' +
        '<label class="field">Details <span class="hint">(optional)</span><textarea class="textarea" name="details" rows="3" maxlength="500"></textarea></label>' +
        '<p class="hint">Reports are anonymous to the employer. The team checks every one.</p>',
      submit: 'Send report',
      onSubmit: function (fd) {
        db.reports.unshift({ title: j.title + ', ' + j.company, reason: fd.get('reason') });
        save(); toast('Thanks. The team will check this role.');
      }
    });
  }

  // ==========================================================================
  // Reviews
  // ==========================================================================
  function reviewHTML(r) {
    return '<li class="review"><div class="review-head"><span>' + starsTxt(r.rating) + ' <span class="sr-only">' + r.rating + ' out of 5</span> <strong>' + esc(r.role) + '</strong></span>' +
      '<span class="who">' + esc(r.author || 'Anonymous student') + ', ' + fmtDate(r.date) + '</span></div><p>' + esc(r.text) + '</p></li>';
  }
  function reviewsBlock(name, title) {
    var list = db.reviews[name] || [], r = ratingOf(name);
    return '<div class="section-head"><h2 class="section-title">' + title + '</h2>' + (r ? '<span class="rating-sum"><span class="big tnum">' + r.avg.toFixed(1) + '</span>' + starsTxt(r.avg) + '<span class="muted">' + plural(r.n, 'review', 'reviews') + '</span></span>' : '') + '</div>' +
      (list.length ? '<ul class="reviews">' + list.map(reviewHTML).join('') + '</ul>' : '<p class="empty-line">No reviews yet.</p>');
  }
  // A student can review an employer once per accepted application.
  function reviewableApp(company) {
    if (db.session !== 'student') return null;
    return db.apps.filter(function (a) { var j = findJob(a.job); return j && j.company === company && a.status === 'Accepted' && !a.reviewed; })[0] || null;
  }
  var RATING_LABEL = { 5: 'Excellent', 4: 'Good', 3: 'OK', 2: 'Poor', 1: 'Bad' };
  function openReview(app) {
    var j = findJob(app.job);
    openModal({
      title: 'Review ' + j.company,
      body: '<p class="hint">For: ' + esc(j.title) + '. Only students who were accepted for a role can review it.</p>' +
        '<fieldset><legend>Your rating</legend><div class="star-pick">' + [5, 4, 3, 2, 1].map(function (n) {
          return '<label class="check"><input type="radio" name="rating" value="' + n + '"' + (n === 5 ? ' required' : '') + '> ' + starsTxt(n) + ' ' + n + ' <span class="muted">' + RATING_LABEL[n] + '</span></label>';
        }).join('') + '</div></fieldset>' +
        '<label class="field">What was it like?<textarea class="textarea" name="text" rows="4" required minlength="10" maxlength="600" placeholder="Pay, schedule, training, how you were treated."></textarea></label>' +
        '<label class="check" style="align-items:flex-start"><input type="checkbox" name="anon" style="margin-top:4px"> <span>Post anonymously. Your name is hidden from the employer and other students. The GigoMe team can still see who wrote it.</span></label>',
      submit: 'Post review',
      onSubmit: function (fd) {
        var r = { rating: +fd.get('rating'), text: fd.get('text').trim(), author: fd.get('anon') ? null : shortName(db.profile.name), role: j.title, date: todayISO() };
        (db.reviews[j.company] = db.reviews[j.company] || []).unshift(r);
        db.myReviews.push({ company: j.company, review: r });
        app.reviewed = true;
        save(); toast('Review posted on <a href="#employer/' + slug(j.company) + '">' + esc(j.company) + '</a>.'); refresh();
      }
    });
  }

  // ==========================================================================
  // Employer public page (#employer/<slug>)
  // ==========================================================================
  function renderEmployerPage(s) {
    var name = companyBySlug(s) || 'Nebbia Coffee Bar';
    var info = companyInfo(name);
    var jobs = allJobs().filter(function (j) { return j.company === name; });
    var following = db.follows.indexOf(name) !== -1, canReview = reviewableApp(name);
    var contact = '';
    if (db.session === 'student') {
      var rows = [];
      if (info.contactName) rows.push(['Contact', esc(info.contactName)]);
      if (info.email) rows.push(['Email', '<a href="mailto:' + esc(info.email) + '">' + esc(info.email) + '</a>']);
      if (info.phone) rows.push(['Phone', esc(info.phone)]);
      if (info.site) rows.push(['Website', esc(info.site)]);
      contact = rows.length ? '<dl class="contact-list">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' : '<p class="hint">Contact this employer through one of their roles.</p>';
    } else {
      contact = '<p class="hint">Sign in as a student to see contact details.</p><button type="button" class="btn btn-secondary btn-sm" data-signin>Sign in</button>';
    }
    $('employer-root').innerHTML =
      '<a class="back" href="#jobs"><svg class="icon" aria-hidden="true"><use href="#i-back"/></svg>All roles</a>' +
      '<div class="detail"><article>' +
        '<h1 class="page-title">' + esc(name) + '</h1>' +
        '<p class="emp-meta">' + (info.verified ? '<span class="verified"><svg class="icon" aria-hidden="true"><use href="#i-verified"/></svg>Reviewed by the GigoMe team</span>' : '<span>Not verified yet</span>') +
          '<span>' + esc(kindLabel(info) || 'Employer') + '</span><span>' + esc(info.showLocation ? info.area : 'Area on request') + '</span>' + ratingHTML(name) + '</p>' +
        '<p class="emp-desc">' + esc(info.desc) + '</p>' +
        '<section class="emp-block" aria-label="Open roles"><div class="section-head"><h2 class="section-title">Open roles</h2><span class="muted tnum">' + jobs.length + '</span></div>' +
          (jobs.length ? '<ul class="role-list">' + jobs.map(function (j) { return row(j, false); }).join('') + '</ul>' : '<p class="empty-line">No open roles right now. Follow ' + esc(name) + ' to hear about the next one.</p>') + '</section>' +
        '<section class="emp-block" aria-label="Reviews">' + reviewsBlock(name, 'Reviews from students') +
          (canReview ? '<p style="margin-top:var(--s4)"><button type="button" class="btn btn-primary" data-review>Write a review</button></p>' : '<p class="hint" style="margin-top:var(--s3)">Only students who were accepted for a role here can leave a review.</p>') + '</section>' +
      '</article>' +
      '<aside aria-label="Follow and contact"><div class="apply">' +
        '<button type="button" class="btn ' + (following ? 'btn-secondary' : 'btn-primary') + '" data-follow="' + esc(name) + '" aria-pressed="' + following + '">' + (following ? 'Following' : 'Follow ' + esc(name)) + '</button>' +
        '<p class="apply-note">Get an alert in your dashboard and by email when they post a new role.</p>' +
        '<div class="employer"><strong>Contact</strong>' + contact + '</div>' +
      '</div></aside></div>';
    $('employer-root').dataset.company = name;
  }
  $('employer-root').addEventListener('click', function (e) {
    if (e.target.closest('[data-review]')) { var a = reviewableApp($('employer-root').dataset.company); if (a) openReview(a); }
  });

  // ==========================================================================
  // Student sign-up (#signup): verification by code, profile, live preview
  // ==========================================================================
  var suForm = $('signup-form'), langs = [];
  $('lang-list').innerHTML = LANGS.map(function (l) { return '<option value="' + l + '">'; }).join('');
  $('nat-list').innerHTML = NATIONALITIES.map(function (l) { return '<option value="' + l + '">'; }).join('');
  var F = function (n) { return suForm.elements.namedItem(n); };
  var editing = function () { return db.session === 'student' && !!db.profile; };

  function renderVerify() {
    var v = db.verify || {}, box = $('su-verify');
    if (v.verified) {
      box.innerHTML = '<div class="email-line"><span class="verified"><svg class="icon" aria-hidden="true"><use href="#i-verified"/></svg><strong>' + esc(v.email) + '</strong></span><span class="muted">Verified</span>' +
        (editing() ? '' : '<button type="button" class="btn-link" data-v="change">Change</button>') + '</div>';
    } else if (v.sent) {
      box.innerHTML = '<p>We sent a 6-digit code to <strong>' + esc(v.email) + '</strong>. <button type="button" class="btn-link" data-v="change">Change email</button></p>' +
        '<div class="inline-form" style="margin-top:var(--s3)"><label class="field" style="flex:0 1 200px">6-digit code<input class="input tnum" id="su-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-describedby="su-v-err"></label>' +
        '<button type="button" class="btn btn-primary" data-v="check">Verify</button><button type="button" class="btn btn-tertiary btn-sm" data-v="resend">Send a new code</button></div>' +
        '<p class="note" style="margin-top:var(--s3)">Demo: no email is sent. Your code is <strong class="tnum">' + esc(v.code) + '</strong>.</p>' +
        '<p class="err" id="su-v-err" hidden style="margin-top:var(--s2)"></p>';
    } else {
      box.innerHTML = '<div class="inline-form"><label class="field">University email<input class="input" id="su-email-input" type="email" autocomplete="email" placeholder="name@university.it" value="' + esc(v.email || '') + '" aria-describedby="su-v-err"></label>' +
        '<button type="button" class="btn btn-primary" data-v="send">Send code</button></div>' +
        '<p class="err" id="su-v-err" hidden style="margin-top:var(--s2)"></p>';
    }
    renderStep();
  }
  function vErr(msg) { var e = $('su-v-err'); if (!e) return; e.textContent = msg; e.hidden = !msg; var i = $('su-code') || $('su-email-input'); if (i) { i.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) i.focus(); } }
  function newCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
  function verifyAction(act) {
    var v = db.verify || {};
    if (act === 'send') {
      var email = $('su-email-input').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return vErr('Enter a valid email address.');
      if (PERSONAL_DOMAINS.test(email)) return vErr('Use your university email, not a personal one.');
      db.verify = { email: email, code: newCode(), sent: true, verified: false };
    } else if (act === 'resend') { v.code = newCode(); db.verify = v; toast('New code sent.'); }
    else if (act === 'change') { db.verify = { email: v.email }; }
    else if (act === 'check') {
      var code = $('su-code').value.replace(/\D/g, '');
      if (code.length !== 6) return vErr('Enter the 6-digit code.');
      if (code !== v.code) return vErr('That code doesn\'t match. Check it or send a new one.');
      v.verified = true; v.sent = false; db.verify = v; toast('Student email verified.');
    }
    save(); renderVerify();
    var next = act === 'check' ? F('fullname') : ($('su-code') || $('su-email-input'));
    if (next) next.focus();
  }
  $('su-verify').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) verifyAction(b.dataset.v); });
  $('su-verify').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'su-email-input') { e.preventDefault(); verifyAction('send'); }
    if (e.target.id === 'su-code') { e.preventDefault(); verifyAction('check'); }
  });

  function readProfile() {
    var avail = []; each(suForm.querySelectorAll('input[name=avail]:checked'), function (el) { avail.push(el.value); });
    var val = function (n) { return F(n).value.trim(); };
    return {
      name: val('fullname'), username: val('username').replace(/^@/, ''), email: val('cemail'), age: val('age'), showAge: F('showAge').checked,
      nationality: val('nationality'), showNat: F('showNat').checked, programme: val('programme'), year: F('year').value,
      langs: langs.slice(), avail: avail, intro: val('intro'), education: val('education'), experience: val('experience'),
      ambitions: val('ambitions'), personality: val('personality'), soft: val('soft'), hard: val('hard'),
      consent: F('consent').checked, alerts: F('alerts').checked,
      studentEmail: db.verify && db.verify.verified ? db.verify.email : ''
    };
  }
  function fillProfile(p) {
    p = p || {};
    var set = function (n, v) { F(n).value = v || ''; };
    set('fullname', p.name); set('username', p.username); set('cemail', p.email); set('age', p.age); set('nationality', p.nationality);
    set('programme', p.programme); F('year').value = p.year || '2nd year';
    ['intro', 'education', 'experience', 'ambitions', 'personality', 'soft', 'hard'].forEach(function (n) { set(n, p[n]); });
    F('showAge').checked = !!p.showAge; F('showNat').checked = !!p.showNat;
    each(suForm.querySelectorAll('input[name=avail]'), function (el) { el.checked = (p.avail || []).indexOf(el.value) !== -1; });
    F('consent').checked = !!p.consent || editing(); F('alerts').checked = !!p.alerts;
    langs = (p.langs || []).map(function (l) { return l.slice(); });
    each(suForm.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
    $('su-errors').hidden = true;
    renderLangs();
  }
  function langText(l) { return l[0] + ', ' + l[1].toLowerCase(); }
  function speaks(list) { return list.map(function (l) { return l[1] === 'Basic' ? 'basic ' + l[0] : l[0]; }).join(', '); }
  function renderLangs() {
    $('lang-tags').innerHTML = langs.length ? langs.map(function (l, i) {
      return '<span class="lang-tag">' + esc(langText(l)) + ' <button type="button" data-lang="' + i + '" aria-label="Remove ' + esc(l[0]) + '">&times;</button></span>';
    }).join('') : '<span class="hint">No languages yet. Add at least English.</span>';
    renderPreview();
  }
  $('lang-tags').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b) return;
    langs.splice(+b.dataset.lang, 1); renderLangs();
    var next = $('lang-tags').querySelector('[data-lang]') || $('lang-name'); next.focus();
  });
  function addLang() {
    var name = $('lang-name').value.trim(), err = $('lang-err');
    err.hidden = true;
    if (!name) { err.textContent = 'Type a language first.'; err.hidden = false; $('lang-name').focus(); return; }
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (langs.some(function (l) { return l[0].toLowerCase() === name.toLowerCase(); })) { err.textContent = name + ' is already on your list.'; err.hidden = false; return; }
    langs.push([name, $('lang-level').value]); $('lang-name').value = ''; renderLangs(); $('lang-name').focus();
  }
  $('lang-add-btn').addEventListener('click', addLang);
  $('lang-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLang(); } });

  // The profile card employers see. Used in the sign-up preview and the employer's applicant list.
  function profileCard(p) {
    var rows = [];
    if (p.age && p.showAge) rows.push(['Age', esc(p.age)]);
    if (p.nationality && p.showNat) rows.push(['Nationality', esc(p.nationality)]);
    rows.push(['Speaks', p.langs && p.langs.length ? esc(speaks(p.langs)) : '<span class="muted">No languages yet</span>']);
    rows.push(['Available', p.avail && p.avail.length ? esc(p.avail.join(', ')) : '<span class="muted">Not set</span>']);
    if (p.email) rows.push(['Contact', esc(p.email)]);
    var bg = [['About', p.intro], ['Education', p.education], ['Past experience', p.experience], ['Ambitions', p.ambitions], ['Personality', p.personality], ['Soft skills', p.soft], ['Hard skills', p.hard]].filter(function (r) { return r[1]; });
    var verified = p.verified !== undefined ? p.verified : !!p.studentEmail;
    return '<div class="preview-card">' +
      '<span class="avatar" aria-hidden="true">' + esc(p.name ? initials(p.name) : '?') + '</span>' +
      '<p class="name">' + esc(p.name || 'Your name') + '</p>' +
      (p.username ? '<p class="handle">@' + esc(p.username) + '</p>' : '') +
      '<p class="muted" style="font-size:14px">' + esc([p.programme, p.year].filter(Boolean).join(', ') || 'Programme') + '</p>' +
      '<p style="margin-top:var(--s2);font-size:14px">' + (verified ? '<span class="verified"><svg class="icon" aria-hidden="true"><use href="#i-verified"/></svg>Verified student</span>' : '<span class="muted">Student email not verified yet</span>') + '</p>' +
      '<dl>' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      (bg.length ? '<dl class="bg">' + bg.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '</div>';
  }
  function renderPreview() { $('su-preview').innerHTML = profileCard(readProfile()); renderStep(); }
  function renderStep() {
    if (editing()) { $('su-progress').hidden = true; return; }
    $('su-progress').hidden = false;
    var p = readProfile(), verified = !!(db.verify && db.verify.verified);
    var basics = verified && p.name && p.username && p.email && p.age;
    var step = !verified ? 1 : !basics ? 2 : 3;
    $('su-step').textContent = ['Step 1 of 3: Verify your student email', 'Step 2 of 3: Build your profile', 'Step 3 of 3: Check and finish'][step - 1];
    each($('su-progress').querySelectorAll('.progress-bar span'), function (s, i) { s.classList.toggle('done', i < step); });
  }
  suForm.addEventListener('input', function (e) { if (e.target.id !== 'lang-name' && e.target.id !== 'su-code' && e.target.id !== 'su-email-input') renderPreview(); });
  suForm.addEventListener('change', function (e) { if (e.target.id !== 'lang-level') renderPreview(); });

  $('su-draft').addEventListener('click', function () { db.draft = readProfile(); save(); toast('Draft saved in this browser.'); });
  suForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var p = readProfile(), errs = [], first = null;
    each(suForm.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
    var bad = function (el, msg) { el.setAttribute('aria-invalid', 'true'); errs.push(msg); if (!first) first = el; };
    if (!db.verify || !db.verify.verified) { errs.push('Verify your student email.'); first = first || $('su-email-input') || $('su-code'); }
    if (!p.name) bad(F('fullname'), 'Add your name.');
    if (!/^[A-Za-z0-9._]{3,20}$/.test(p.username)) bad(F('username'), 'Choose a username of 3 to 20 letters, numbers, dots or underscores.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) bad(F('cemail'), 'Add a contact email.');
    var age = +p.age;
    if (!p.age || age < 16 || age > 99) bad(F('age'), 'Add your age (16 or older).');
    if (!p.langs.length) { errs.push('Add at least one language.'); first = first || $('lang-name'); }
    if (!p.consent) bad(F('consent'), 'Agree to the privacy notice.');
    if (errs.length) {
      $('su-errors').innerHTML = errs.map(esc).join('<br>'); $('su-errors').hidden = false;
      if (first) first.focus();
      return;
    }
    $('su-errors').hidden = true;
    var wasEditing = editing();
    p.verified = true;
    db.profile = p; db.draft = null; db.session = 'student';
    if (!wasEditing) db.kpi.students++;
    save(); renderAuth();
    toast(wasEditing ? 'Profile saved.' : 'Welcome to GigoMe, ' + esc(p.name.split(' ')[0]) + '. Your profile is ready.');
    go(wasEditing ? '#me' : '#jobs');
  });
  function renderSignup() {
    var ed = editing();
    $('su-title').textContent = ed ? 'Edit your profile' : 'Create your student profile';
    $('su-lead').textContent = ed ? 'Changes show to employers straight away.' : 'Free. Employers only see what you choose to share.';
    $('su-draft').hidden = ed;
    $('su-finish').textContent = ed ? 'Save changes' : 'Finish and browse roles';
    if (ed && (!db.verify || !db.verify.verified)) db.verify = { email: db.profile.studentEmail, verified: true };
    fillProfile(ed ? db.profile : db.draft);
    renderVerify();
  }

  // ==========================================================================
  // Student dashboard (#me)
  // ==========================================================================
  var meTab = 'All';
  function renderMe() {
    var root = $('me-root');
    if (db.session !== 'student' || !db.profile) {
      root.innerHTML = '<h1 class="page-title">Your dashboard</h1><p class="muted" style="margin-top:var(--s2)">Track applications, saved roles and alerts in one place.</p>' +
        '<div class="btn-row" style="margin-top:var(--s5)"><button type="button" class="btn btn-primary" data-signin>Sign in</button><a class="btn btn-secondary" href="#signup">Create a student profile</a></div>';
      return;
    }
    var p = db.profile;
    var counts = { All: db.apps.length, Applied: 0, Accepted: 0, Rejected: 0 };
    db.apps.forEach(function (a) { counts[a.status]++; });
    var apps = db.apps.map(function (a, i) { return { a: a, i: i, j: findJob(a.job) }; }).filter(function (x) { return x.j && (meTab === 'All' || x.a.status === meTab); });
    var unread = db.notes.filter(function (n) { return !n.read; }).length;

    root.innerHTML =
      '<div class="dash-head"><div><h1 class="page-title">Hi, ' + esc(p.name.split(' ')[0]) + '</h1>' +
        '<p class="muted">@' + esc(p.username) + (p.programme ? ' · ' + esc(p.programme) : '') + '</p></div>' +
        '<div class="btn-row"><a class="btn btn-secondary" href="#signup">Edit profile</a><button type="button" class="btn btn-tertiary btn-sm" data-signout>Sign out</button></div></div>' +

      '<section class="dash-block" id="me-alerts" aria-labelledby="me-alerts-t"><div class="section-head"><h2 class="section-title" id="me-alerts-t">Alerts' + (unread ? ' <span class="badge tnum">' + unread + '</span>' : '') + '</h2>' +
        (db.notes.length ? '<button type="button" class="btn btn-tertiary btn-sm" data-me="read">Mark all as read</button>' : '') + '</div>' +
        '<label class="check" style="font-size:14px;margin-bottom:var(--s3)"><input type="checkbox" data-avail-alerts' + (p.alerts ? ' checked' : '') + '> Email me about new roles that fit my availability' +
          (p.avail && p.avail.length ? ' (' + esc(p.avail.join(', ').toLowerCase()) + ')' : ' (set your availability in <a href="#signup">your profile</a>)') + '</label>' +
        (db.notes.length ? '<ul class="plain-list">' + db.notes.slice(0, 8).map(function (n) {
          return '<li><div><a href="' + esc(n.href) + '"' + (n.read ? '' : ' style="font-weight:600"') + '>' + esc(n.text) + '</a>' + (n.read ? '' : ' <span class="sr-only">(new)</span>') + '</div><span class="muted">' + fmtDate(n.date) + '</span></li>';
        }).join('') + '</ul>' : '<p class="empty-line">No alerts yet. Turn on availability alerts, save a search or follow an employer to hear about new roles.</p>') + '</section>' +

      '<section class="dash-block" id="me-apps" aria-labelledby="me-apps-t"><div class="section-head"><h2 class="section-title" id="me-apps-t">My applications</h2>' +
        '<p class="hint">Applied on a company site? Update the status when you hear back.</p></div>' +
        '<div class="tabs" role="group" aria-label="Filter applications">' + ['All', 'Applied', 'Accepted', 'Rejected'].map(function (t) {
          return '<button type="button" data-tab="' + t + '" aria-pressed="' + (meTab === t) + '">' + t + ' <span class="tnum">' + counts[t] + '</span></button>';
        }).join('') + '</div>' +
        (apps.length ? '<table class="table"><thead><tr><th scope="col">Role</th><th scope="col">Employer</th><th scope="col">Applied</th><th scope="col">How</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
          apps.map(function (x) {
            var review = x.a.status === 'Accepted' ? (x.a.reviewed ? '<span class="muted">Reviewed</span>' : '<button type="button" class="btn btn-secondary btn-sm" data-review-app="' + x.i + '">Review employer</button>') : '';
            return '<tr><td><a href="#job/' + esc(x.j.id) + '">' + esc(x.j.title) + '</a></td><td data-label="Employer"><a href="#employer/' + slug(x.j.company) + '">' + esc(x.j.company) + '</a></td>' +
              '<td data-label="Applied" class="tnum">' + fmtDate(x.a.date) + '</td><td data-label="How">' + (x.a.via === 'email' ? 'By email' : 'Company site') + '</td>' +
              '<td data-label="Status"><label class="sr-only" for="st-' + x.i + '">Status for ' + esc(x.j.title) + '</label><select class="select" id="st-' + x.i + '" data-status="' + x.i + '">' +
                ['Applied', 'Accepted', 'Rejected'].map(function (s) { return '<option' + (s === x.a.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
              '<td><div class="actions">' + review + '</div></td></tr>';
          }).join('') + '</tbody></table>'
          : '<p class="empty-line">' + (db.apps.length ? 'No ' + meTab.toLowerCase() + ' applications.' : 'No applications yet. <a href="#jobs">Browse roles</a>') + '</p>') + '</section>' +

      '<div class="dash-grid">' +
      '<section class="dash-block" id="me-saved" aria-labelledby="me-saved-t"><div class="section-head"><h2 class="section-title" id="me-saved-t">Saved roles</h2></div>' +
        (db.saved.length ? '<ul class="plain-list">' + db.saved.map(findJob).filter(Boolean).map(function (j) {
          return '<li><div><a href="#job/' + esc(j.id) + '">' + esc(j.title) + '</a><span class="sub">' + esc(j.company) + ', ' + esc(j.pay) + '</span></div><div class="actions"><button type="button" class="btn btn-tertiary btn-sm" data-unsave="' + esc(j.id) + '">Remove</button></div></li>';
        }).join('') + '</ul>' : '<p class="empty-line">Nothing saved yet. Use "Save" on any role.</p>') + '</section>' +

      '<section class="dash-block" id="me-searches" aria-labelledby="me-searches-t"><div class="section-head"><h2 class="section-title" id="me-searches-t">Saved searches and email alerts</h2></div>' +
        (db.searches.length ? '<ul class="plain-list">' + db.searches.map(function (s, i) {
          return '<li><div><strong>' + esc(s.name) + '</strong><span class="sub">' + esc(summary(s.state)) + ', ' + plural(filtered(s.state).length, 'role', 'roles') + ' now</span>' +
            '<label class="check" style="font-size:14px;min-height:28px"><input type="checkbox" data-alert="' + i + '"' + (s.alerts ? ' checked' : '') + '> Email alerts</label></div>' +
            '<div class="actions"><button type="button" class="btn btn-secondary btn-sm" data-run="' + i + '">Show roles</button><button type="button" class="btn btn-tertiary btn-sm" data-del-search="' + i + '">Delete</button></div></li>';
        }).join('') + '</ul>' : '<p class="empty-line">No saved searches. Set filters on <a href="#jobs">Jobs</a> and press "Save search".</p>') + '</section>' +

      '<section class="dash-block" id="me-follows" aria-labelledby="me-follows-t"><div class="section-head"><h2 class="section-title" id="me-follows-t">Employers you follow</h2></div>' +
        (db.follows.length ? '<ul class="plain-list">' + db.follows.map(function (n) {
          var open = allJobs().filter(function (j) { return j.company === n; }).length;
          return '<li><div><a href="#employer/' + slug(n) + '">' + esc(n) + '</a><span class="sub">' + plural(open, 'open role', 'open roles') + '</span></div><div class="actions"><button type="button" class="btn btn-tertiary btn-sm" data-follow="' + esc(n) + '">Unfollow</button></div></li>';
        }).join('') + '</ul>' : '<p class="empty-line">Follow employers from their page to hear about new roles first.</p>') + '</section>' +

      '<section class="dash-block" aria-labelledby="me-data-t"><div class="section-head"><h2 class="section-title" id="me-data-t">Your data</h2></div>' +
        '<p class="hint">Download everything GigoMe stores about you, or delete your account.</p>' +
        '<div class="btn-row" style="margin-top:var(--s3)"><button type="button" class="btn btn-secondary btn-sm" data-me="download">Download my data</button><button type="button" class="btn btn-tertiary btn-sm" data-me="delete">Delete my account</button></div></section>' +
      '</div>';
  }
  $('me-root').addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('[data-tab]'))) { meTab = b.dataset.tab; renderMe(); $('me-root').querySelector('[data-tab="' + meTab + '"]').focus(); return; }
    if ((b = t.closest('[data-review-app]'))) { openReview(db.apps[+b.dataset.reviewApp]); return; }
    if ((b = t.closest('[data-unsave]'))) { toggleSaved(b.dataset.unsave); renderMe(); return; }
    if ((b = t.closest('[data-run]'))) { state = clone(db.searches[+b.dataset.run].state); location.hash = '#jobs'; return; }
    if ((b = t.closest('[data-del-search]'))) { db.searches.splice(+b.dataset.delSearch, 1); save(); renderMe(); toast('Saved search deleted.'); return; }
    if ((b = t.closest('[data-me]'))) {
      var act = b.dataset.me;
      if (act === 'read') { db.notes.forEach(function (n) { n.read = true; }); save(); renderAuth(); renderMe(); }
      if (act === 'download') downloadData();
      if (act === 'delete') openModal({
        title: 'Delete your account?',
        body: '<p>This deletes your profile, applications, saved roles, saved searches and alerts. Reviews you posted stay up, shown as "Anonymous student".</p>',
        submit: 'Delete my account',
        onSubmit: function () {
          (db.myReviews || []).forEach(function (m) { m.review.author = null; var list = db.reviews[m.company] || []; list.forEach(function (r) { if (r.text === m.review.text && r.date === m.review.date) r.author = null; }); });
          db.profile = null; db.verify = null; db.draft = null; db.apps = []; db.saved = []; db.searches = []; db.follows = []; db.notes = []; db.myReviews = []; db.session = null;
          save(); renderAuth(); toast('Your account was deleted.'); go('#home');
        }
      });
    }
  });
  $('me-root').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.status !== undefined) { db.apps[+t.dataset.status].status = t.value; save(); renderMe(); toast('Status updated.'); }
    if (t.dataset.availAlerts !== undefined) { db.profile.alerts = t.checked; save(); toast(t.checked ? 'You\'ll get an email when a role that fits your availability goes live.' : 'Availability alerts off.'); return; }
    if (t.dataset.alert !== undefined) { db.searches[+t.dataset.alert].alerts = t.checked; save(); toast(t.checked ? 'Email alerts on.' : 'Email alerts off.'); }
  });
  function downloadData() {
    var data = { profile: db.profile, applications: db.apps.map(function (a) { var j = findJob(a.job); return { role: j && j.title, employer: j && j.company, applied: a.date, via: a.via, status: a.status }; }),
      savedRoles: db.saved.map(findJob).filter(Boolean).map(function (j) { return j.title + ', ' + j.company; }), savedSearches: db.searches, following: db.follows, reviews: db.myReviews };
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'gigome-my-data.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ==========================================================================
  // Employer: account setup, dashboard, listings, applicants, past employees
  // ==========================================================================
  var coEdit = false, openListing = null, postEditing = null;
  function employerForm(e, mode) {
    e = e || { type: 'business', showLocation: true };
    var priv = e.type === 'private';
    return '<form class="emp-form" id="emp-form" data-mode="' + mode + '" novalidate>' +
      '<fieldset><legend>Who is hiring?</legend><div class="choices">' +
        '<label class="choice"><input type="radio" name="type" value="business"' + (!priv ? ' checked' : '') + (mode === 'edit' ? ' disabled' : '') + '><span><strong>A business or organisation</strong><span class="hint">Cafés, shops, startups, studios, schools, agencies.</span></span></label>' +
        '<label class="choice"><input type="radio" name="type" value="private"' + (priv ? ' checked' : '') + (mode === 'edit' ? ' disabled' : '') + '><span><strong>A private person</strong><span class="hint">For example, a family looking for a tutor or someone who needs a dog walker.</span></span></label>' +
      '</div></fieldset>' +
      '<div class="form-row">' +
        '<label class="field"><span data-name-label>' + (priv ? 'Your name' : 'Business name') + '</span>' + (mode === 'edit' ? '<span class="hint">Contact the team to change it</span>' : '') + '<input class="input" name="ename" required maxlength="60" value="' + esc(e.name || '') + '"' + (mode === 'edit' ? ' disabled' : '') + ' placeholder="' + (priv ? 'e.g. Giulia R.' : 'e.g. Nebbia Coffee Bar') + '"></label>' +
        '<label class="field" data-biz' + (priv ? ' hidden' : '') + '>Sector<input class="input" name="sector" maxlength="60" value="' + esc(e.sector || '') + '" placeholder="e.g. Food and hospitality"></label>' +
      '</div>' +
      '<div class="stack-s"><label class="field">Area of Milan<input class="input" name="area" list="area-list" required maxlength="40" value="' + esc(e.area || '') + '" placeholder="e.g. Porta Venezia"></label>' +
        '<label class="check" style="font-size:14px"><input type="checkbox" name="showLocation"' + (e.showLocation !== false ? ' checked' : '') + '> Show my area to students and on the map</label>' +
        '<p class="hint">Turn this off to share your location only when you reply to a student. Your roles then show "Area on request" and stay off the map.</p></div>' +
      '<fieldset><legend>Contact information</legend><p class="hint" style="margin-bottom:var(--s3)">Signed-in students see this on your employer page.</p>' +
        '<div class="form-row"><label class="field">Contact person<input class="input" name="contactName" maxlength="60" value="' + esc(e.contactName || '') + '" autocomplete="name"></label>' +
        '<label class="field">Email<input class="input" name="email" type="email" required value="' + esc(e.email || '') + '" autocomplete="email"></label></div>' +
        '<div class="form-row" style="margin-top:var(--s4)"><label class="field">Phone <span class="hint">(optional)</span><input class="input" name="phone" type="tel" value="' + esc(e.phone || '') + '" autocomplete="tel"></label>' +
        '<label class="field" data-biz' + (priv ? ' hidden' : '') + '>Website <span class="hint">(optional)</span><input class="input" name="site" value="' + esc(e.site || '') + '" placeholder="example.it"></label></div>' +
      '</fieldset>' +
      '<label class="field">' + (priv ? 'About you and the help you need' : 'About the business') + '<textarea class="textarea" name="desc" rows="4" maxlength="600">' + esc(e.desc || '') + '</textarea></label>' +
      (mode === 'setup'
        ? '<fieldset><legend>Verification</legend><div class="choices">' +
            '<label class="choice"><input type="radio" name="verify" value="requested" checked><span><strong>Ask the GigoMe team to verify me</strong><span class="hint">Recommended. The team checks that the business or person is real, usually within one working day. Verified employers get a mark on every role.</span></span></label>' +
            '<label class="choice"><input type="radio" name="verify" value="none"><span><strong>Not now</strong><span class="hint">Your roles still go through review, but show as "Not verified". You can ask later.</span></span></label>' +
          '</div></fieldset>' +
          '<label class="check" style="align-items:flex-start"><input type="checkbox" name="terms" required style="margin-top:4px"> <span>I agree to the <a href="#terms">terms</a> and will only post real, paid roles. (Required)</span></label>'
        : '') +
      '<div class="form-actions">' + (mode === 'edit' ? '<button type="button" class="btn btn-secondary" data-co="cancel-edit">Cancel</button>' : '') +
        '<button type="submit" class="btn btn-primary">' + (mode === 'edit' ? 'Save profile' : 'Create employer account') + '</button></div>' +
      '<p class="err form-errors" id="emp-errors" role="alert" hidden></p>' +
    '</form>';
  }
  function readEmployerForm(f, mode) {
    var g = function (n) { var el = f.elements.namedItem(n); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
    var type = mode === 'edit' ? db.employer.type : (f.querySelector('input[name=type]:checked') || {}).value;
    return { type: type, name: mode === 'edit' ? db.employer.name : g('ename'), sector: type === 'private' ? '' : g('sector'), area: g('area'), showLocation: g('showLocation'),
      contactName: g('contactName'), email: g('email'), phone: g('phone'), site: type === 'private' ? '' : g('site'), desc: g('desc'), verify: g('verify'), terms: g('terms') };
  }
  function submitEmployerForm(f, mode) {
    var e = readEmployerForm(f, mode), errs = [], first = null;
    each(f.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
    var bad = function (n, msg) { var el = f.elements.namedItem(n); el.setAttribute('aria-invalid', 'true'); errs.push(msg); if (!first) first = el; };
    if (mode === 'setup' && !e.name) bad('ename', e.type === 'private' ? 'Add your name.' : 'Add the business name.');
    if (mode === 'setup' && e.name && allCompanies().indexOf(e.name) !== -1 && (!db.employer || db.employer.name !== e.name)) bad('ename', 'An employer with this name already exists. Sign in instead.');
    if (!e.area) bad('area', 'Add your area of Milan.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) bad('email', 'Add a contact email.');
    if (mode === 'setup' && !e.terms) bad('terms', 'Agree to the terms.');
    if (errs.length) { var box = f.querySelector('#emp-errors'); box.innerHTML = errs.map(esc).join('<br>'); box.hidden = false; if (first) first.focus(); return; }
    if (mode === 'edit') {
      ['sector', 'area', 'showLocation', 'contactName', 'email', 'phone', 'site', 'desc'].forEach(function (k) { db.employer[k] = e[k]; });
      coEdit = false; save(); toast('Profile saved.'); renderCompany(); return;
    }
    delete e.terms;
    db.employer = e; db.listings = []; db.applicants = {}; db.past = []; db.session = 'employer';
    if (e.verify === 'requested') db.queue.push({ kind: 'Company', title: e.name, detail: (e.type === 'private' ? 'Private employer' : e.sector || 'Business') + ', ' + e.area + '. Asked to be verified.', submitted: 'Today', employer: true });
    save(); renderAuth(); window.scrollTo(0, 0);
    toast('Account created. Post your first role below.');
    renderCompany();
  }
  // Show or hide business-only fields when the account type changes.
  on(document, 'change', function (e) {
    if (e.target.name !== 'type' || !e.target.closest('#emp-form')) return;
    var f = e.target.closest('#emp-form'), priv = e.target.value === 'private';
    each(f.querySelectorAll('[data-biz]'), function (el) { el.hidden = priv; });
    f.querySelector('[data-name-label]').textContent = priv ? 'Your name' : 'Business name';
    f.elements.namedItem('ename').placeholder = priv ? 'e.g. Giulia R.' : 'e.g. Nebbia Coffee Bar';
  });
  on(document, 'submit', function (e) {
    if (e.target.id !== 'emp-form') return;
    e.preventDefault(); submitEmployerForm(e.target, e.target.dataset.mode);
  });

  function applicantsFor(jobId) {
    var list = (db.applicants[jobId] || []).map(function (a, i) { return { a: a, key: 's' + i }; });
    // The demo student's own application to this employer's role
    db.apps.forEach(function (a, i) { if (a.job === jobId && db.profile) list.unshift({ a: { name: db.profile.name, programme: [db.profile.programme, db.profile.year].filter(Boolean).join(', '), date: a.date, via: a.via, status: a.status, me: true }, key: 'm' + i }); });
    return list;
  }
  function renderCompany() {
    var signedIn = db.session === 'employer' && db.employer;
    $('co-landing').hidden = !!signedIn; $('co-dash').hidden = !signedIn;
    if (signedIn) $('co-landing').innerHTML = ''; else { $('co-top').innerHTML = ''; coEdit = false; }
    if (!signedIn) {
      $('co-landing').innerHTML = '<div class="co-landing"><h1 class="page-title">Hire international students in Milan</h1>' +
        '<p class="lead">Free for businesses and private people. Post a role in five minutes and reach students who speak English and are ready to work.</p>' +
        '<p style="margin-top:var(--s4)">Already have an account? <button type="button" class="btn-link" data-signin="employer">Sign in</button></p>' +
        '<h2 class="section-title" style="margin-top:var(--s7)">Create an employer account</h2>' + employerForm(null, 'setup') + '</div>';
      return;
    }
    var e = db.employer, info = companyInfo(e.name);
    var mark = e.verify === 'verified' ? '<span class="verified"><svg class="icon" aria-hidden="true"><use href="#i-verified"/></svg>Verified employer</span>' : e.verify === 'requested' ? '<span class="tag tag-review">Verification requested</span>' : '<span class="tag tag-draft">Not verified</span>';
    var verifyNote = e.verify === 'requested' ? '<p class="note co-note">Verification requested. The GigoMe team usually replies within one working day.</p>'
      : e.verify !== 'verified' ? '<p class="note co-note">Your account isn\'t verified. Verified employers get a mark on every role and more applications. <button type="button" class="btn-link" data-co="verify">Ask the team to verify you</button></p>' : '';
    $('co-top').innerHTML = '<div class="co-head"><div>' +
        '<h1>' + esc(e.name) + ' ' + mark + '</h1>' +
        '<p>' + esc([kindLabel(info), e.area ? e.area + ', Milan' : '', e.site].filter(Boolean).join('. ')) + (e.showLocation === false ? '. <strong>Area hidden from students</strong>' : '') + '</p>' +
        (e.desc ? '<p class="co-desc">' + esc(e.desc) + '</p>' : '') +
        '<p>' + ratingHTML(e.name, true) + '</p>' +
      '</div><div class="btn-row"><button type="button" class="btn btn-primary" data-co="goto-post">Post a role</button><button type="button" class="btn btn-secondary" data-co="edit" aria-expanded="' + coEdit + '">Edit profile</button><a class="btn btn-tertiary btn-sm" href="#employer/' + slug(e.name) + '">View public page</a><button type="button" class="btn btn-tertiary btn-sm" data-signout>Sign out</button></div></div>' +
      verifyNote +
      (coEdit ? '<div class="co-edit"><h2 class="section-title">Edit profile</h2>' + employerForm(e, 'edit') + '</div>' : '');

    // Listings with applications
    var rows = db.listings.map(function (L) {
      var apps = L.job ? applicantsFor(L.job) : [], waiting = apps.filter(function (x) { return x.a.status === 'Applied'; }).length;
      var tag = { Live: 'tag-live', 'In review': 'tag-review', Draft: 'tag-draft', 'Not approved': 'tag-draft' }[L.status] || 'tag-draft';
      var action = L.job ? '<button type="button" class="btn btn-secondary btn-sm" data-co="toggle" data-id="' + L.id + '" aria-expanded="' + (openListing === L.id) + '">' + (openListing === L.id ? 'Hide applicants' : 'View applicants') + '</button>'
        : (L.status === 'Draft' || L.status === 'Not approved') ? '<button type="button" class="btn btn-secondary btn-sm" data-co="edit-listing" data-id="' + L.id + '">Edit</button>' : '';
      var main = '<tr' + (openListing === L.id ? ' class="open"' : '') + '><td>' + (L.job ? '<a href="#job/' + esc(L.job) + '">' + esc(L.title) + '</a>' : esc(L.title)) + '</td><td data-label="Type">' + TYPE[L.cat] + '</td>' +
        '<td data-label="Status"><span class="tag ' + tag + '">' + L.status + '</span></td>' +
        '<td data-label="Applications" class="tnum">' + (L.job ? apps.length + (waiting ? ' <span class="muted">(' + waiting + ' new)</span>' : '') : '<span class="muted">None yet</span>') + '</td>' +
        '<td data-label="Updated">' + esc(L.updated) + '</td><td><div class="actions">' + action + '</div></td></tr>';
      if (openListing !== L.id) return main;
      return main + '<tr class="sub-row"><td colspan="6">' + (apps.length ? '<ul class="plain-list applicants">' + apps.map(function (x) {
        var a = x.a;
        return '<li><div><strong>' + esc(a.name) + '</strong>' + (a.me ? ' <span class="tag">Demo student</span>' : '') + '<span class="sub">' + esc(a.programme) + '. Applied ' + fmtDate(a.date) + ' ' + (a.via === 'email' ? 'by email' : 'on your site') + '.</span></div>' +
          '<div class="actions">' + statusTag(a.status) + '<button type="button" class="btn btn-tertiary btn-sm" data-co="profile" data-id="' + L.job + '" data-key="' + x.key + '">View profile</button>' +
          (a.status === 'Applied' ? '<button type="button" class="btn btn-secondary btn-sm" data-co="reject" data-id="' + L.job + '" data-key="' + x.key + '">Reject</button><button type="button" class="btn btn-primary btn-sm" data-co="accept" data-id="' + L.job + '" data-key="' + x.key + '">Accept</button>' : '') +
          '</div></li>';
      }).join('') + '</ul>' : '<p class="muted" style="padding:var(--s3) 0">No applications yet.</p>') + '</td></tr>';
    }).join('');
    $('co-listings').innerHTML = '<div class="section-head"><h2 class="section-title">Your listings</h2><span class="hint">Accept or reject applicants so students know where they stand.</span></div>' +
      (db.listings.length ? '<table class="table"><thead><tr><th scope="col">Listing</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Applications</th><th scope="col">Updated</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p class="empty-line">No listings yet. Post your first role below.</p>');

    // Past employees
    var recurring = db.past.filter(function (p) { return p.recurring; }).length;
    $('co-past').innerHTML = '<div class="section-head"><h2 class="section-title">Past employees</h2><span class="muted tnum">' + (recurring ? plural(recurring, 'recurring employee', 'recurring employees') : '') + '</span></div>' +
      '<p class="hint" style="margin-bottom:var(--s3)">Students who have worked for you. Tick "Alert first" for people you\'d hire again: when your next role goes live, they get an alert before everyone else.</p>' +
      (db.past.length ? '<table class="table"><thead><tr><th scope="col">Name</th><th scope="col">Last role</th><th scope="col">Last worked</th><th scope="col">Recurring</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        db.past.map(function (p, i) {
          return '<tr><td><strong>' + esc(p.name) + '</strong></td><td data-label="Last role">' + esc(p.role) + '</td><td data-label="Last worked">' + esc(p.last) + '</td>' +
            '<td data-label="Recurring"><label class="check" style="font-size:14px;min-height:24px"><input type="checkbox" data-recurring="' + i + '"' + (p.recurring ? ' checked' : '') + '> Alert first</label></td>' +
            '<td><div class="actions">' + (p.invited ? '<span class="muted" style="font-size:14px">Invited: ' + esc(p.invited) + '</span>' : '') + '<button type="button" class="btn btn-secondary btn-sm" data-co="invite" data-id="' + i + '">Invite to apply</button></div></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="empty-line">No past employees yet. Students you accept appear here.</p>');

    $('co-reviews').innerHTML = reviewsBlock(e.name, 'Reviews from students') +
      '<p class="hint" style="margin-top:var(--s3)">Only students you accepted can review you. Anonymous reviews don\'t show the student\'s name.</p>';
  }

  // Send a past employee a personal alert about one of your live roles.
  function openInvite(person) {
    var live = db.listings.filter(function (L) { return L.status === 'Live' && L.job && findJob(L.job); });
    if (!live.length) { toast('You have no live roles yet. Post one, and invite ' + esc(person.name) + ' once it\'s approved.'); return; }
    openModal({
      title: 'Invite ' + person.name + ' to apply',
      body: '<label class="field">Role<select class="select" name="job">' + live.map(function (L) { return '<option value="' + esc(L.job) + '">' + esc(L.title) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field">Message <span class="hint">(optional)</span><textarea class="textarea" name="msg" rows="4" maxlength="500">' + esc('Hi ' + person.name.split(' ')[0] + ', we loved working with you on ' + person.role + '. Would you like to apply for this one?') + '</textarea></label>' +
        '<p class="hint">' + esc(person.name) + ' gets an alert by email and in their GigoMe dashboard, with a link to the role.</p>',
      submit: 'Send invite',
      onSubmit: function (fd) {
        var j = findJob(fd.get('job'));
        person.invited = j.title;
        if (db.profile && person.name === db.profile.name) note(db.employer.name + ' invited you to apply for ' + j.title + ': "' + fd.get('msg').trim() + '"', '#job/' + j.id);
        save(); renderAuth(); renderCompany(); toast('Invite sent to ' + esc(person.name) + '.');
      }
    });
  }
  function decideApplicant(jobId, key, status) {
    var j = findJob(jobId), name;
    if (key.charAt(0) === 'm') {
      var app = db.apps[+key.slice(1)]; app.status = status; name = db.profile.name;
      note(j.company + (status === 'Accepted' ? ' accepted' : ' declined') + ' your application for ' + j.title + (status === 'Accepted' ? '. You can now review them.' : '.'), '#me');
    } else {
      var a = db.applicants[jobId][+key.slice(1)]; a.status = status; name = a.name;
    }
    if (status === 'Accepted' && !db.past.some(function (p) { return p.name === name; })) db.past.unshift({ name: name, role: j.title, last: 'Now', recurring: false });
    save(); renderAuth(); renderCompany();
    toast(esc(name) + (status === 'Accepted' ? ' accepted. They\'ve been told and added to your past employees.' : ' rejected. They\'ve been told.'));
  }
  $('page-company').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-co]');
    if (!b) return;
    var act = b.dataset.co, id = b.dataset.id;
    if (act === 'edit') { coEdit = !coEdit; renderCompany(); if (coEdit) $('emp-form').querySelector('input:not([disabled])').focus(); }
    else if (act === 'cancel-edit') { coEdit = false; renderCompany(); }
    else if (act === 'goto-post') { $('co-post').scrollIntoView({ block: 'start' }); post.elements.namedItem('title').focus({ preventScroll: true }); }
    else if (act === 'verify') {
      db.employer.verify = 'requested';
      db.queue.push({ kind: 'Company', title: db.employer.name, detail: kindLabel(companyInfo(db.employer.name)) + ', ' + db.employer.area + '. Asked to be verified.', submitted: 'Today', employer: true });
      save(); renderCompany(); toast('Verification requested. The team will check your account.');
    }
    else if (act === 'toggle') { openListing = openListing === id ? null : id; renderCompany(); }
    else if (act === 'invite') openInvite(db.past[+id]);
    else if (act === 'accept' || act === 'reject') decideApplicant(id, b.dataset.key, act === 'accept' ? 'Accepted' : 'Rejected');
    else if (act === 'profile') {
      var key = b.dataset.key, p;
      if (key.charAt(0) === 'm') { p = clone(db.profile); p.studentEmail = p.studentEmail || 'yes'; }
      else { var a = db.applicants[id][+key.slice(1)]; p = { name: a.name, programme: a.programme, langs: a.langs, avail: a.avail, verified: true }; }
      if (!p.showAge) delete p.age;
      if (!p.showNat) delete p.nationality;
      openModal({ title: p.name, body: profileCard(p) + '<p class="hint">Students choose what employers see. The student email is never shown.</p>', cancel: 'Close' });
    }
    else if (act === 'edit-listing') {
      var L = db.listings.filter(function (x) { return x.id === id; })[0];
      fillPost(L.draft || { title: L.title, cat: L.cat }); postEditing = id;
      $('co-post').scrollIntoView({ block: 'start' }); $('post-form').elements.namedItem('title').focus();
      toast('Editing "' + esc(L.title) + '". Submit it for review when ready.');
    }
  });
  $('page-company').addEventListener('change', function (e) {
    var r = e.target.dataset.recurring;
    if (r === undefined) return;
    db.past[+r].recurring = e.target.checked; save(); renderCompany();
    toast(e.target.checked ? esc(db.past[+r].name) + ' will get an alert first about your next role.' : 'Alert first turned off.');
  });

  // Post a role
  var post = $('post-form');
  var P = function (n) { return post.elements.namedItem(n); };
  function readPost() {
    var area = P('area').value.trim(), pay = P('pay').value.trim();
    var remote = /^remote$/i.test(area);
    var known = JOBS.filter(function (j) { return j.area.toLowerCase() === area.toLowerCase() && j.metro; })[0];
    return {
      title: P('title').value.trim(), cat: P('cat').value, area: remote ? 'Remote' : area, metro: known ? known.metro.slice() : undefined,
      mode: remote ? 'Remote' : 'On-site', when: [P('when').value], lang: post.querySelector('input[name=lang]:checked').value,
      pay: pay, rate: hourlyRate(pay), duration: P('cat').value === 'parttime' || P('cat').value === 'tutoring' ? 'Ongoing' : P('cat').value === 'internship' ? '3 months' : '1 day',
      desc: P('desc').value.trim(), apply: post.querySelector('input[name=apply]:checked').value, applyTo: P('applyTo').value.trim()
    };
  }
  function fillPost(d) {
    P('title').value = d.title || ''; P('cat').value = d.cat || 'parttime'; P('area').value = d.area || ''; P('pay').value = d.pay || '';
    P('when').value = (d.when && d.when[0]) || 'Weekends'; P('desc').value = d.desc || ''; P('applyTo').value = d.applyTo || '';
    each(post.querySelectorAll('input[name=lang]'), function (r) { r.checked = r.value === (d.lang || 'en'); });
    each(post.querySelectorAll('input[name=apply]'), function (r) { r.checked = r.value === (d.apply || 'link'); });
    syncApply();
  }
  function syncApply() {
    var email = post.querySelector('input[name=apply]:checked').value === 'email';
    P('applyTo').type = email ? 'email' : 'url';
    P('applyTo').placeholder = email ? 'jobs@example.it' : 'https://';
    $('apply-url-label').textContent = email ? 'Application email' : 'Application link';
  }
  post.addEventListener('change', function (e) { if (e.target.name === 'apply') syncApply(); });
  function postErrors(d, full) {
    var errs = [], first = null;
    each(post.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
    var bad = function (n, msg) { P(n).setAttribute('aria-invalid', 'true'); errs.push(msg); if (!first) first = P(n); };
    if (!d.title) bad('title', 'Add a role title.');
    if (full) {
      if (!d.area) bad('area', 'Add a location, or "Remote".');
      if (!/\d/.test(d.pay)) bad('pay', 'Add the pay, for example €11/h or €100/day.');
      if (d.apply === 'link' && d.applyTo && !/^https?:\/\/\S+\.\S+/.test(d.applyTo)) bad('applyTo', 'The application link should start with https://');
      if (d.apply === 'email' && d.applyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.applyTo)) bad('applyTo', 'Check the application email.');
      if (!d.applyTo) bad('applyTo', d.apply === 'email' ? 'Add the email students should write to.' : 'Add the link to your application page.');
    }
    var box = $('post-errors');
    box.innerHTML = errs.map(esc).join('<br>'); box.hidden = !errs.length;
    if (first) first.focus();
    return errs.length;
  }
  function upsertListing(d, status) {
    var L = postEditing && db.listings.filter(function (x) { return x.id === postEditing; })[0];
    if (!L) { L = { id: 'l' + Date.now() }; db.listings.unshift(L); }
    L.title = d.title; L.cat = d.cat; L.status = status; L.updated = 'Today'; L.draft = d;
    postEditing = null;
    return L;
  }
  $('post-draft').addEventListener('click', function () {
    var d = readPost(); if (postErrors(d, false)) return;
    upsertListing(d, 'Draft'); save(); fillPost({}); renderCompany(); toast('Draft saved to your listings.');
  });
  $('post-preview').addEventListener('click', function () {
    var d = readPost(); if (postErrors(d, true)) return;
    var j = clone(d); j.id = 'preview'; j.company = db.employer.name; j.posted = 0; j.match = 0;
    openModal({ title: 'Preview', body: '<p class="hint">How your role looks in the list:</p><ul class="role-list">' + row(j, false).replace(/href="[^"]*"/, 'href="#company"') + '</ul>' +
      '<p class="hint">Description</p><p>' + esc(detailOf(j).about) + '</p>', cancel: 'Back to editing' });
  });
  post.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = readPost(); if (postErrors(d, true)) return;
    var L = upsertListing(d, 'In review');
    db.queue.push({ kind: 'Listing', title: d.title, detail: db.employer.name + ', ' + TYPE[d.cat].toLowerCase(), submitted: 'Today', listing: L.id });
    var rec = db.past.filter(function (p) { return p.recurring; }).length;
    save(); fillPost({}); renderCompany();
    $('co-listings').scrollIntoView({ block: 'start' });
    toast('Submitted for review. ' + (rec ? 'When it goes live, your ' + plural(rec, 'recurring employee is', 'recurring employees are') + ' told first.' : 'You\'ll see it go live in "Your listings".'));
  });

  // ==========================================================================
  // Admin
  // ==========================================================================
  // A new role goes live: alert matching saved searches, followers and recurring employees.
  function goLive(job) {
    db.posted.push(job);
    var searches = 0, fans = 0, rec = 0, fits = 0, why = [];
    db.searches.forEach(function (s) { if (s.alerts && passes(job, s.state)) { searches++; why.push('matches "' + s.name + '"'); } });
    if (db.follows.indexOf(job.company) !== -1) { fans++; why.push('from ' + job.company + ', which you follow'); }
    if (db.profile && db.profile.alerts && fitsAvail(job, db.profile.avail)) { fits++; why.push('fits your availability'); }
    // One alert per new role for the student, listing every reason it was sent.
    if (why.length) note('New role: ' + job.title + ' at ' + job.company + ' (' + why.join(', ') + ')', '#job/' + job.id);
    if (db.employer && job.company === db.employer.name) rec = db.past.filter(function (p) { return p.recurring; }).length;
    var sent = [];
    if (rec) sent.push(plural(rec, 'recurring employee', 'recurring employees') + ' (first)');
    if (searches) sent.push(plural(searches, 'saved search', 'saved searches'));
    if (fans) sent.push(plural(fans, 'follower', 'followers'));
    if (fits) sent.push(plural(fits, 'student', 'students') + ' whose availability fits');
    return sent.length ? ' Alerts sent to ' + sent.join(', ') + '.' : '';
  }
  function decide(i, ok) {
    var it = db.queue[i], msg = (ok ? 'Approved: ' : 'Rejected: ') + esc(it.title) + '.';
    db.queue.splice(i, 1);
    if (it.kind === 'Listing') {
      var L = it.listing && db.listings.filter(function (x) { return x.id === it.listing; })[0];
      var src = L ? L.draft : it.job;
      if (L) { L.status = ok ? 'Live' : 'Not approved'; L.updated = 'Today'; }
      if (ok && src) {
        var job = clone(src); job.id = 'n' + Date.now(); job.company = job.company || db.employer.name; job.posted = 0; job.match = 75;
        job.rate = job.rate || hourlyRate(job.pay); job.duration = job.duration || '1 day'; job.mode = job.mode || 'On-site';
        if (L) L.job = job.id;
        msg += ' It\'s live.' + goLive(job);
      }
    } else if (it.kind === 'Company') {
      if (it.employer && db.employer) db.employer.verify = ok ? 'verified' : 'none';
      else if (ok && it.company) db.verified[it.company] = true;
      if (ok) db.kpi.companies++;
    } else if (it.kind === 'Student' && ok) db.kpi.students++;
    save(); renderAuth(); renderAdmin(); toast(msg);
    var next = $('queue').querySelector('[data-decide]'); if (next) next.focus();
  }
  function renderAdmin() {
    var k = db.kpi, live = allJobs().length;
    var pct = function (n, goal) { return Math.min(100, Math.round(n / goal * 100)); };
    $('kpis').innerHTML =
      '<div class="kpi"><p class="label">Verified students</p><p class="num tnum">' + k.students + ' <small>/ 100</small></p><div class="bar" role="img" aria-label="' + pct(k.students, 100) + ' percent of the student goal"><span style="width:' + pct(k.students, 100) + '%"></span></div></div>' +
      '<div class="kpi"><p class="label">Reviewed companies</p><p class="num tnum">' + k.companies + ' <small>/ 10</small></p><div class="bar" role="img" aria-label="' + pct(k.companies, 10) + ' percent of the company goal"><span style="width:' + pct(k.companies, 10) + '%"></span></div></div>' +
      '<div class="kpi"><p class="label">Live listings</p><p class="num tnum">' + live + '</p><p class="hint">Apply clicks are tracked per listing.</p></div>';
    var q = db.queue;
    $('queue').innerHTML = q.map(function (it, i) {
      return '<tr><td data-label="Type">' + it.kind + '</td><td><strong>' + esc(it.title) + '</strong></td><td data-label="Details" class="muted">' + esc(it.detail) + '</td><td data-label="Submitted">' + esc(it.submitted) + '</td>' +
        '<td><div class="actions"><button type="button" class="btn btn-secondary btn-sm" data-decide="' + i + '" data-ok="0" aria-label="Reject ' + esc(it.title) + '">Reject</button><button type="button" class="btn btn-primary btn-sm" data-decide="' + i + '" data-ok="1" aria-label="Approve ' + esc(it.title) + '">Approve</button></div></td></tr>';
    }).join('');
    $('queue-table').hidden = !q.length;
    $('queue-empty').hidden = q.length > 0;
    $('queue-badge').textContent = q.length;
    $('queue-badge').hidden = !q.length;
    $('queue-label').textContent = q.length ? plural(q.length, 'item', 'items') + ' waiting' : '';
    $('reports').innerHTML = db.reports.map(function (r) { return '<li><span>' + esc(r.title) + '</span><span class="muted">' + esc(r.reason) + '</span></li>'; }).join('') || '<li class="muted">No reports.</li>';
    $('feedback').innerHTML = db.feedback.slice(0, 6).map(function (f) { return '<li><span>' + esc(f.text) + '</span><span class="muted">' + esc(f.who) + '</span></li>'; }).join('');
    var students = SEED_STUDENTS.slice();
    if (db.profile) students.unshift({ name: db.profile.name, programme: db.profile.programme || 'Not set', joined: 'Today' });
    $('students').innerHTML = students.map(function (s) { return '<tr><td><strong>' + esc(s.name) + '</strong></td><td data-label="Programme">' + esc(s.programme) + '</td><td data-label="Joined">' + esc(s.joined) + '</td><td data-label="Status"><span class="tag tag-live">Verified</span></td></tr>'; }).join('');
    $('students-label').textContent = 'Newest ' + students.length + ' of ' + k.students;
    var cos = allCompanies();
    $('companies').innerHTML = cos.map(function (n) {
      var info = companyInfo(n), open = allJobs().filter(function (j) { return j.company === n; }).length;
      var st = info.status === 'verified' || info.verified ? '<span class="tag tag-live">Verified</span>' : info.status === 'requested' || q.some(function (it) { return it.kind === 'Company' && it.title === n; }) ? '<span class="tag tag-review">Requested</span>' : '<span class="tag tag-draft">Not verified</span>';
      return '<tr><td><a href="#employer/' + slug(n) + '">' + esc(n) + '</a></td><td data-label="Type">' + (info.private ? 'Private' : 'Business') + '</td><td data-label="Open roles" class="tnum">' + open + '</td><td data-label="Rating">' + (ratingHTML(n) || '<span class="muted">None</span>') + '</td><td data-label="Status">' + st + '</td></tr>';
    }).join('');
    $('companies-label').textContent = plural(cos.length, 'employer', 'employers');
  }
  $('queue').addEventListener('click', function (e) {
    var b = e.target.closest('[data-decide]');
    if (b) decide(+b.dataset.decide, b.dataset.ok === '1');
  });

  // ==========================================================================
  // About, feedback, header menu
  // ==========================================================================
  $('team').innerHTML = TEAM.map(function (m) {
    return '<li><span class="initials" aria-hidden="true">' + esc(initials(m.name)) + '</span><span>' + esc(m.name) + (m.role ? '<span class="role">' + esc(m.role) + '</span>' : '') + '</span></li>';
  }).join('');
  $('footer-email').href = 'mailto:' + CONTACT_EMAIL;
  $('footer-email').textContent = CONTACT_EMAIL;
  (function renderContact() {
    var li = function (url) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">GigoMe on LinkedIn</a>' : '<span class="muted">Page coming soon</span>'; };
    var c = CONTACT;
    $('contact-grid').innerHTML =
      [['Students', c.students], ['Employers and partners', c.employers]].map(function (g) {
        var x = g[1];
        return '<div><h3>' + g[0] + '</h3><dl><div><dt>Email</dt><dd><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a></dd></div>' +
          (x.phone ? '<div><dt>Phone</dt><dd><a href="tel:' + esc(x.phone.replace(/\s/g, '')) + '">' + esc(x.phone) + '</a></dd></div>' : '') +
          '<div><dt>LinkedIn</dt><dd>' + li(x.linkedin) + '</dd></div></dl></div>';
      }).join('');
  })();

  function openFeedback(who) {
    who = who || (db.session === 'employer' ? 'employer' : db.session === 'student' ? 'student' : 'student');
    openModal({
      title: who === 'employer' && db.session === 'employer' ? 'How did hiring go?' : 'Give feedback',
      body: '<fieldset><legend>I am</legend><div class="radio-row">' + [['student', 'A student'], ['employer', 'An employer'], ['other', 'Someone else']].map(function (o) {
          return '<label class="check"><input type="radio" name="who" value="' + o[0] + '"' + (o[0] === who ? ' checked' : '') + '> ' + o[1] + '</label>';
        }).join('') + '</div></fieldset>' +
        '<label class="field">Your feedback<textarea class="textarea" name="text" rows="5" required minlength="5" maxlength="1000" placeholder="What worked, what didn\'t, what\'s missing?"></textarea></label>' +
        '<p class="hint">Feedback goes to the GigoMe team. Add your email if you\'d like a reply.</p>',
      submit: 'Send feedback',
      onSubmit: function (fd) {
        var w = fd.get('who');
        db.feedback.unshift({ text: '"' + fd.get('text').trim() + '"', who: w === 'other' ? 'Visitor' : w.charAt(0).toUpperCase() + w.slice(1) });
        save(); toast('Thanks. The team reads every message.');
      }
    });
  }

  var menuBtn = $('menu-btn'), panel = $('menu-panel');
  function setMenu(open) { panel.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.textContent = open ? 'Close' : 'Menu'; }
  menuBtn.addEventListener('click', function () { setMenu(panel.hidden); });
  on(document, 'keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setMenu(false); menuBtn.focus(); } });

  // Global buttons: sign in / out, feedback, follow
  on(document, 'click', function (e) {
    var b;
    if ((b = e.target.closest('[data-signin]'))) {
      setMenu(false);
      var stay = ['job', 'employer', 'jobs', 'home', 'about'].indexOf(current.id) !== -1;
      openSignIn(b.dataset.signin || (current.id === 'company' ? 'employer' : 'student'), stay ? function () { refresh(); } : null);
      return;
    }
    if (e.target.closest('[data-signout]')) { setMenu(false); signOut(); return; }
    if ((b = e.target.closest('[data-feedback]'))) { openFeedback(b.dataset.feedback); return; }
    if ((b = e.target.closest('[data-follow]'))) { toggleFollow(b.dataset.follow); }
  });

  $('reset-demo').addEventListener('click', function () {
    openModal({
      title: 'Reset the demo?', body: '<p>This deletes everything saved in this browser (profile, applications, reviews, listings) and starts again with the sample data.</p>',
      submit: 'Reset',
      onSubmit: function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } db = seed(); location.hash = '#home'; location.reload(); }
    });
  });

  // ==========================================================================
  // Router
  // ==========================================================================
  var PAGES = ['home', 'jobs', 'job', 'employer', 'signup', 'me', 'company', 'admin', 'about', 'privacy', 'terms'];
  var current = { id: '', arg: '' };
  function renderPage(id, arg) {
    if (id === 'home') renderHome();
    else if (id === 'jobs') { renderTypeFilters(); render(); }
    else if (id === 'job') renderJob(arg || 'w1');
    else if (id === 'employer') renderEmployerPage(arg || 'nebbia-coffee-bar');
    else if (id === 'signup') renderSignup();
    else if (id === 'me') renderMe();
    else if (id === 'company') renderCompany();
    else if (id === 'admin') renderAdmin();
  }
  // Re-render the current page after an action that changes data (keeps scroll position).
  function refresh() { if (current.id !== 'signup' && current.id !== 'jobs') renderPage(current.id, current.arg); else if (current.id === 'jobs') render(); }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function route() {
    var parts = (location.hash || '#home').slice(1).split('/');
    var id = PAGES.indexOf(parts[0]) === -1 ? 'home' : parts[0];
    var arg = decodeURIComponent(parts.slice(1).join('/'));
    if (id === 'jobs' && arg) applyDeepLink(arg);
    current = { id: id, arg: arg };
    PAGES.forEach(function (p) { $('page-' + p).classList.toggle('active', p === id); });
    document.body.dataset.page = id;
    each(document.querySelectorAll('.main-nav a'), function (a) {
      if (a.dataset.nav.split(' ').indexOf(id) !== -1) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    each(document.querySelectorAll('#admin-links a'), function (a) {
      if (a.dataset.sec === (id === 'admin' ? arg : '__')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('jump').value = $('jump').querySelector('option[value="' + id + '"]') ? id : '';
    setMenu(false);
    if (drawer.open) drawer.close();
    if (modal.open) modal.close();
    renderPage(id, arg);
    // Sub-sections: #admin/queue, #about/contact, #me/saved, #company/post
    var target = arg && ({ admin: 'adm-' + arg, about: arg, me: 'me-' + arg, company: arg === 'post' ? 'co-post' : '' }[id]);
    var el = target && $(target);
    if (el) setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 0); else window.scrollTo(0, 0);
    if (id === 'home') setTimeout(function () { map.refresh(); }, 0);
  }
  $('jump').addEventListener('change', function (e) {
    var v = e.target.value;
    // The Jump to menu signs in to the sample accounts so every screen can be seen.
    if (v === 'me' && db.session !== 'student') signIn('student');
    if (v === 'company' && db.session !== 'employer') signIn('employer');
    go(v === 'employer' ? '#employer/nebbia-coffee-bar' : v === 'job' ? '#job/w1' : '#' + v);
  });
  on(window, 'hashchange', route);
  renderAuth();
  route();

  return function unmount() { listeners.abort(); };
}
