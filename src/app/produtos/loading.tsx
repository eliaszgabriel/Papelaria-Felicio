import Container from "@/components/layout/Container";

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.05)]">
      <div className="h-[150px] animate-pulse rounded-[1.6rem] bg-white/80" />
      <div className="mt-4 h-4 w-3/4 animate-pulse rounded-full bg-white/80" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-white/80" />
      <div className="mt-4 h-9 w-28 animate-pulse rounded-full bg-white/80" />
    </div>
  );
}

export default function ProdutosLoading() {
  return (
    <main className="py-12">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden rounded-[2rem] border border-white/70 bg-white/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:block">
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/80" />
            <div className="mt-4 h-8 w-40 animate-pulse rounded-full bg-white/80" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-2xl bg-white/80"
                />
              ))}
            </div>
          </aside>

          <section>
            <div className="rounded-[2rem] border border-white/70 bg-white/64 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur-xl sm:p-6">
              <div className="h-4 w-24 animate-pulse rounded-full bg-white/80" />
              <div className="mt-4 h-9 w-40 animate-pulse rounded-full bg-white/80" />
              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,360px)]">
                <div className="h-12 animate-pulse rounded-full bg-white/80" />
                <div className="hidden h-12 animate-pulse rounded-full bg-white/80 xl:block" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
