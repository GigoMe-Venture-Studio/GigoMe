// The profile fields students fill in on /welcome and edit on /account.
// One set of rules for both pages.

// Graduation years on offer: last year to eight years from now (the database
// accepts 1990 to 2100; a saved value outside this range is still shown).
export function yearOptions(saved) {
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now - 1; y <= now + 8; y++) years.push(y);
  if (saved && !years.includes(saved)) years.unshift(saved);
  return years;
}

// Checks the form values. Returns { errors } (by field) or { fields } ready
// for saveProfile(). Company accounts only have a name to fill in.
export function checkProfile({ fullName, degree, year }, { student = true } = {}) {
  const name = String(fullName || '').trim().replace(/\s+/g, ' ');
  const errors = {};
  if (!name) errors.fullName = 'Add your full name.';
  else if (name.length > 120) errors.fullName = 'Keep your name under 120 characters.';
  if (student && !degree) errors.degree = 'Choose what you are studying.';
  if (student && !year) errors.year = 'Choose the year you expect to graduate.';
  if (Object.keys(errors).length) return { errors };
  if (!student) return { errors: {}, fields: { full_name: name } };
  return { errors: {}, fields: { full_name: name, degree_level: degree, graduation_year: Number(year) } };
}

// Tells the header that the name may have changed (it shows the student's name).
export function announceProfileChange() {
  window.dispatchEvent(new Event('gigome:profile-changed'));
}
