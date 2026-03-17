import Container from "../layout/Container";
import Icon from "../ui/Icon";

const items = [
  { icon: "truck" as const, title: "Envio para todo o Brasil" },
  { icon: "lock" as const, title: "Pagamento seguro" },
  { icon: "gift" as const, title: "Entregamos com carinho" },
  { icon: "chat" as const, title: "Atendimento humanizado" },
];

export default function TrustBar() {
  return (
    <section className="py-10">
      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-3xl bg-white/50 border border-white/60 shadow-soft p-5 flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-2xl bg-white/70 border border-white/60 flex items-center justify-center">
                <Icon name={it.icon} className="text-felicio-pink" />
              </div>
              <div className="font-extrabold leading-snug">{it.title}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
