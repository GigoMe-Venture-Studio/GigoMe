// GigoMe's Worker script. It exists for one job: a daily ping to Supabase so
// the free project never pauses for inactivity.
//
// Pages and files are NOT served by this code. Cloudflare serves every file in
// dist/ (and, for browser page loads, index.html for unknown paths) straight
// from static assets without running the Worker, so normal visits stay free
// and don't count towards the Workers request limit. fetch() below only runs
// for the rare request that matches no file and isn't a page load (for
// example a script asking for a missing file); it hands it to the same static
// assets, so nothing changes for the visitor.
//
// The ping needs two runtime variables, set in the Cloudflare dashboard (not in
// the repo): SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(pingSupabase(env));
  }
};

// One tiny read with the publishable key: the first university's id. Throws
// on failure, so the run shows as failed in the Worker's cron event logs.
export async function pingSupabase(env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    throw new Error('Supabase ping skipped: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the Worker settings.');
  }
  const res = await fetch(`${base}/rest/v1/universities?select=id&limit=1`, {
    headers: { apikey: key, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Supabase ping failed: HTTP ${res.status}`);
  console.log(`Supabase ping OK (HTTP ${res.status})`);
}
