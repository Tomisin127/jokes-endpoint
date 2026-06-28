export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          x402 · USDC on Base
        </span>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight">
          Paid Jokes API
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          A pay-per-call API that tells a random interesting joke. Each request
          is settled in USDC on Base through the Coinbase CDP facilitator, with
          a Base Builder Code attributed on every settlement.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <h2 className="text-sm font-semibold">Endpoint</h2>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm">
          <code>GET /api/jokes</code>
        </pre>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Unpaid requests return{" "}
          <span className="font-mono">402 Payment Required</span> with a payment
          challenge. After a valid x402 payment, the endpoint returns the joke
          as JSON.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <h2 className="text-sm font-semibold">Required environment variables</h2>
        <ul className="flex flex-col gap-1 font-mono text-sm text-muted-foreground">
          <li>CDP_API_KEY_ID</li>
          <li>CDP_API_KEY_SECRET</li>
          <li>PAY_TO_ADDRESS</li>
          <li>BUILDER_CODE</li>
        </ul>
      </section>
    </main>
  )
}
