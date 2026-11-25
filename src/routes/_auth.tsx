import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="w-full min-h-screen grid grid-cols-7">
      {/* Left — shader gradient background, 4 cols */}
      <div className="col-span-4 hidden md:block relative">
        {/* Static CSS gradient in KNUST colours. Phase I used a three.js shader
            here, which made the login page download ~1.1 MB of JavaScript. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 20%, #F6BE00 0%, rgba(246,190,0,0) 45%)," +
              "radial-gradient(90% 80% at 80% 70%, #1B6E44 0%, rgba(27,110,68,0) 60%)," +
              "linear-gradient(135deg, #0F4429 0%, #1B6E44 55%, #0F4429 100%)",
          }}
        />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-garamond text-4xl font-semibold leading-tight">Central Energy Database</p>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Assets, maintenance and energy use across the KNUST campus, in one place.
          </p>
        </div>
      </div>

      {/* Right — form, 3 cols */}
      <div className="col-span-7 md:col-span-3 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col gap-10">
          <Link to="/" className="inline-flex items-center space-x-3 self-start">
            <img src="/assets/images/knust-logo.png" alt="KNUST Crest" className="h-14 w-auto" />
            <div className="pt-4 flex flex-col">
              <h1 className="font-garamond font-semibold text-xl tracking-tight m-0 leading-tight">KNUST</h1>
              <p className="text-[0.7rem] font-medium m-0 -mt-0.5 leading-normal">Central Energy Database</p>
            </div>
          </Link>

          <Outlet />
        </div>
      </div>
    </main>
  );
}
