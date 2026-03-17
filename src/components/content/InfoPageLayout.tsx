import Container from "@/components/layout/Container";

type InfoPageSection = {
  title: string;
  body: string[];
};

function renderParagraphWithBold(paragraph: string) {
  const parts = paragraph.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={`${part}-${index}`}
          className="font-extrabold text-felicio-ink/85"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

export default function InfoPageLayout({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoPageSection[];
}) {
  return (
    <main className="py-14">
      <Container>
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:p-10">
          <div className="inline-flex rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-felicio-ink/55">
            {eyebrow}
          </div>

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-felicio-ink sm:text-4xl">
            {title}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-felicio-ink/75">
            {intro}
          </p>

          <div className="mt-8 grid gap-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[1.5rem] border border-white/70 bg-white/72 p-5"
              >
                <h2 className="text-lg font-extrabold text-felicio-ink/85">
                  {section.title}
                </h2>

                <div className="mt-3 space-y-3 text-sm leading-6 text-felicio-ink/72">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{renderParagraphWithBold(paragraph)}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
