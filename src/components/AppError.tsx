import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { envMissing } from "@/lib/env";

/** Shown instead of a blank page when a route throws while loading or rendering. */
export function AppError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-garamond text-6xl font-semibold text-primary">Oops</p>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "An unexpected error occurred."}
      </p>
      <div className="flex gap-4">
        <button onClick={reset} className="text-sm font-medium text-primary underline underline-offset-4">
          Try again
        </button>
        <Link to="/" className="text-sm font-medium text-primary underline underline-offset-4">
          Home
        </Link>
      </div>
    </main>
  );
}

/** Shown when .env.local is missing values, so a new developer knows what to do. */
export function MissingEnv() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Almost there: configure the app</h1>
      <p className="text-sm text-muted-foreground">These environment variables are not set:</p>
      <ul className="list-disc pl-6 font-mono text-sm">
        {envMissing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <ol className="list-decimal space-y-1 pl-6 text-sm">
        <li>
          Copy <code className="rounded bg-muted px-1">.env.example</code> to{" "}
          <code className="rounded bg-muted px-1">.env.local</code> in the project folder.
        </li>
        <li>Fill in the values (see README, section “Set up Supabase”).</li>
        <li>
          Stop and restart <code className="rounded bg-muted px-1">npm run dev</code>.
        </li>
      </ol>
    </main>
  );
}
