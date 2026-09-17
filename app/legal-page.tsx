import Link from "next/link";

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export default function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: Section[];
}) {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <Link href="/login" className="legal-brand">
            Estúdio Fluxo
          </Link>
          <span>Atualizado em 15 de setembro de 2026</span>
        </header>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <footer className="legal-footer">
          <Link href="/login">Voltar ao login</Link>
          <a href="mailto:oericfrantto@gmail.com">oericfrantto@gmail.com</a>
        </footer>
      </article>
    </main>
  );
}
