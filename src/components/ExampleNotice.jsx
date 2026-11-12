// The notice at the top of an example listing's page and an example
// company's page (made-up listings for testers, supabase/seed/examples.sql):
// the same dark badge as on the cards, then why.
export default function ExampleNotice({ label, children }) {
  return (
    <p className="example-notice" role="note">
      <span className="tag tag-example">{label}</span> <span>{children}</span>
    </p>
  );
}
