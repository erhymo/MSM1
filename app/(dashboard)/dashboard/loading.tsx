import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-[1600px] animate-pulse space-y-8">
        <Card className="grid gap-5 p-6 xl:grid-cols-[1.55fr_1fr] xl:p-7">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="h-7 w-20 rounded-full bg-white/10" />
              <div className="h-7 w-36 rounded-full bg-white/10" />
              <div className="h-7 w-32 rounded-full bg-white/10" />
            </div>
            <div className="h-10 w-72 rounded-2xl bg-white/10" />
            <div className="h-5 w-full max-w-2xl rounded-full bg-white/10" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-28 rounded-[28px] border border-white/10 bg-white/[0.03]" />
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="h-5 w-52 rounded-full bg-white/10" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-24 rounded-3xl border border-white/10 bg-black/10" />
              ))}
            </div>
            <div className="h-10 w-32 rounded-2xl bg-white/10" />
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <section className="space-y-4">
            <div className="space-y-2">
              <div className="h-6 w-44 rounded-full bg-white/10" />
              <div className="h-4 w-80 rounded-full bg-white/10" />
            </div>

            <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="h-[430px] p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="h-3 w-16 rounded-full bg-white/10" />
                        <div className="h-8 w-24 rounded-full bg-white/10" />
                      </div>
                      <div className="h-7 w-24 rounded-full bg-white/10" />
                    </div>
                    <div className="h-28 rounded-[28px] border border-white/10 bg-black/10" />
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 4 }).map((__, innerIndex) => (
                        <div key={innerIndex} className="h-20 rounded-2xl border border-white/10 bg-black/10" />
                      ))}
                    </div>
                    <div className="h-28 rounded-[28px] border border-white/10 bg-white/[0.03]" />
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <Card className="p-5">
            <div className="space-y-3">
              <div className="h-6 w-36 rounded-full bg-white/10" />
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-2xl border border-white/10 bg-white/[0.03]" />
                ))}
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 rounded-2xl border border-white/10 bg-white/[0.03]" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}