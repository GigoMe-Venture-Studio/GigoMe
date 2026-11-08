import { useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CodeLogin from '../components/CodeLogin.jsx';
import { supabase } from '../lib/supabase.js';
import { safeNext } from '../lib/auth.js';

// Student login: university email, then the 6-digit code.
export default function Login() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  return <PageShell>{supabase ? <CodeLogin audience="student" next={next} /> : <ConfigError />}</PageShell>;
}
