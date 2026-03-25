export default function ProdutoLoading() {
  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-full bg-white/80" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,420px)]">
          <div className="h-[420px] animate-pulse rounded-[2rem] bg-white/80" />
          <div className="rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-soft">
            <div className="h-5 w-24 animate-pulse rounded-full bg-white/80" />
            <div className="mt-4 h-10 w-3/4 animate-pulse rounded-full bg-white/80" />
            <div className="mt-4 h-6 w-1/3 animate-pulse rounded-full bg-white/80" />
            <div className="mt-8 h-12 w-full animate-pulse rounded-full bg-white/80" />
          </div>
        </div>
      </div>
    </section>
  );
}
