// A question that opens to show its answer (native <details>: works with a
// keyboard and screen readers, without JavaScript). Used by /how-it-works.
export default function Faq({ id, question, children }) {
  return (
    <details className="faq" id={id}>
      <summary>{question}</summary>
      <div className="faq-answer">{children}</div>
    </details>
  );
}
