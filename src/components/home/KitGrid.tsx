import Container from "../layout/Container";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { kits } from "@/data/kits";

export default function KitGrid() {
  return (
    <section id="kits" className="py-10">
      <Container>
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold">
            Kits Prontos com{" "}
            <span className="text-felicio-pink">muito carinho</span>
          </h2>
          <p className="mt-2 text-felicio-ink/75">
            Tudo que você precisa, em kits fofos e prontos para presentear.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {kits.map((k, idx) => (
            <Card key={k.id} className="p-4">
              <div
                className="aspect-[4/3] rounded-2xl bg-gradient-to-br border border-white/60 shadow-soft
                from-felicio-pink/20 via-felicio-sun/20 to-felicio-lilac/20 flex items-center justify-center"
              >
                <div className="text-sm font-bold text-felicio-ink/70">
                  Foto do Kit {idx + 1}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs font-extrabold text-felicio-ink/70">
                  {k.tag ?? "Kits"}
                </div>
                <div className="text-xs rounded-full bg-white/70 border border-white/60 px-2 py-1">
                  novo
                </div>
              </div>

              <h3 className="mt-2 font-extrabold leading-snug">{k.title}</h3>
              <p className="mt-1 text-sm text-felicio-ink/70">{k.subtitle}</p>

              <div className="mt-4 text-xl font-extrabold">
                R$ {k.price.toFixed(2).replace(".", ",")}
              </div>

              <div className="mt-4">
                <Button className="w-full">Ver kit</Button>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
