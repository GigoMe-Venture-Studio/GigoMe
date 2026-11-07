// The main content area of a page. The header (SiteHeader) and footer
// (SiteFooter) are shown on every page by App.jsx.
export default function PageShell({ children, className = 'auth-main' }) {
  return <main className={`wrap ${className}`}>{children}</main>;
}
