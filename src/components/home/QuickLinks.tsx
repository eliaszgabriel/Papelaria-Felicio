import Container from "../layout/Container";

const links = [
  {
    label: "Volta às Aulas",
    color: "from-felicio-sun/45 to-white/70",
    id: "volta",
  },
  {
    label: "Presentes Criativos",
    color: "from-felicio-pink/35 to-white/70",
    id: "presentes",
  },
  {
    label: "Organização",
    color: "from-felicio-mint/35 to-white/70",
    id: "produtos",
  },
  {
    label: "Promoções",
    color: "from-felicio-lilac/30 to-white/70",
    id: "promos",
  },
];

export default function QuickLinks() {
  return (
    <section className="pb-10">
      <Container>
        <div className="flex flex-wrap gap-3 rounded-3xl border border-white/60 bg-white/50 p-3 shadow-soft">
          {links.map((l) => (
            <a
              key={l.label}
              href={`#${l.id}`}
              className={`flex-1 min-w-[160px] rounded-2xl bg-gradient-to-br ${l.color} border border-white/60 px-4 py-3 text-center text-sm font-extrabold hover:brightness-[0.99] transition`}
            >
              {l.label}
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
