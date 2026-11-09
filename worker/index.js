// GigoMe's Worker script. It exists for one job: a daily ping to Supabase so
// the free project never pauses for inactivity.
//
// Pages and files are NOT served by this code. Cloudflare serves every file in
// dist/ (and, for browser page loads, index.html for unknown paths) straight
// from static assets without running the Worker, so normal visits stay free
// and don't count towards the Workers request limit. fetch() below only runs
// for the rare request that matches no file and isn't a page load (for
// example a script asking for a missing file). A missing build file under
// /assets/ (an old file name after a deploy) gets a real 404 that browsers
// don't keep; anything else goes back to the same static assets.
//
// The ping needs two runtime variables, set in the Cloudflare dashboard (not in
// the repo): SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/assets/')) return assetNotFound();
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(pingSupabase(env));
  }
};

// Every file under /assets/ that exists is served before this script runs,
// so reaching here means the file isn't there. Not the home page, and not
// cached: the next deploy may well have it.
export function assetNotFound() {
  return new Response('Not found\n', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

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
