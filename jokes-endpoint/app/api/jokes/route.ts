import { NextRequest, NextResponse } from "next/server"
// `withX402` wraps a single route handler: settlement only happens after the
// handler returns a successful (<400) response. `x402ResourceServer` is the
// resource-server instance; both are re-exported from `@x402/next`.
import { withX402, x402ResourceServer, type RouteConfig } from "@x402/next"
// HTTP client that talks to a facilitator's /verify, /settle, /supported endpoints.
import { HTTPFacilitatorClient } from "@x402/core/server"
// Server-side "exact" scheme implementation for EVM networks (Base). Without a
// registered scheme, `buildPaymentRequirements` returns an EMPTY challenge, so
// this registration is what makes the 402 (and its extensions) actually appear.
import { ExactEvmScheme } from "@x402/evm/exact/server"
// Coinbase CDP facilitator config. Reads CDP_API_KEY_ID / CDP_API_KEY_SECRET
// from the environment and signs requests to the CDP facilitator.
import { facilitator } from "@coinbase/x402"
// Builder Code (ERC-8021) attribution extension. The `BUILDER_CODE` constant is
// the keyed extension id ("builder-code"); `declareBuilderCodeExtension` returns
// an UNKEYED { info, schema } object that MUST live under that key.
// `builderCodeResourceServerExtension` registers the resource server side handler.
import {
  BUILDER_CODE,
  builderCodeResourceServerExtension,
  declareBuilderCodeExtension,
} from "@x402/extensions/builder-code"
// Bazaar discovery extension so agents can discover this endpoint. Unlike the
// builder-code helper, `declareDiscoveryExtension` returns an already-KEYED
// object, so it is SPREAD into `extensions` rather than nested under a key.
// `bazaarResourceServerExtension` registers the resource server side handler for discovery.
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar"

// The CDP facilitator signs requests with Node crypto, so run on the Node runtime.
export const runtime = "nodejs"

// Base mainnet in CAIP-2 format.
const BASE_MAINNET = "eip155:8453" as const

// --- Environment configuration (never hardcode secrets or addresses) ---------

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS
// Base Builder Code for attribution (ERC-8021). Set via environment variable.
const MY_BUILDER_CODE = process.env.BUILDER_CODE ?? "bc_95iwepxu"

/**
 * Validate required environment up front so misconfiguration fails loudly with a
 * clear message instead of producing a confusing 500 at settlement time.
 */
function assertEnv(): { payTo: string } {
  const missing: string[] = []
  if (!CDP_API_KEY_ID) missing.push("CDP_API_KEY_ID")
  if (!CDP_API_KEY_SECRET) missing.push("CDP_API_KEY_SECRET")
  if (!PAY_TO_ADDRESS) missing.push("PAY_TO_ADDRESS")

  if (missing.length > 0) {
    throw new Error(
      `[x402] Missing required environment variable(s): ${missing.join(
        ", ",
      )}. Set them in your project's environment (CDP keys come from https://portal.cdp.coinbase.com) and redeploy.`,
    )
  }

  return { payTo: PAY_TO_ADDRESS as string }
}

// --- Resource server: CDP facilitator + Base "exact" scheme -------------------

// Validate environment and initialize resource server (lazy, on first request)
let resourceServer: InstanceType<typeof x402ResourceServer> | null = null
let initError: Error | null = null
let initAttempted = false

function getResourceServer() {
  if (initAttempted) {
    if (initError) throw initError
    return resourceServer
  }

  initAttempted = true

  try {
    assertEnv()
    resourceServer = new x402ResourceServer(
      new HTTPFacilitatorClient(facilitator),
    )
      .register(BASE_MAINNET, new ExactEvmScheme())
      .registerExtension(builderCodeResourceServerExtension)
      .registerExtension(bazaarResourceServerExtension)
    return resourceServer
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error))
    console.error("[x402] Failed to initialize resource server:", initError.message)
    throw initError
  }
}

// --- Route payment config -----------------------------------------------------

const routeConfig: RouteConfig = {
  // Price the request in USDC on Base mainnet, paid to our receiving wallet.
  accepts: {
    scheme: "exact",
    network: BASE_MAINNET,
    price: "$0.01",
    payTo: PAY_TO_ADDRESS || "0x1234567890123456789012345678901234567890",
  },
  description: "Returns a random interesting joke.",
  mimeType: "application/json",
  serviceName: "Random Joke API",
  tags: ["jokes", "entertainment", "fun"],
  extensions: {
    // KEYED entry: builder-code attribution (ERC-8021). The facilitator will append the
    // full ERC-8021 suffix including the marker to the settlement transaction calldata.
    [BUILDER_CODE]: declareBuilderCodeExtension(MY_BUILDER_CODE),
    // SPREAD: Bazaar discovery extension for agent marketplace discoverability.
    // Agents and tools can discover this endpoint through the Bazaar protocol.
    ...declareDiscoveryExtension({
      routeTemplate: "/api/jokes",
      input: {
        method: "GET",
      },
      description: "Get a random interesting joke. Perfect for entertainment, icebreakers, and comic relief.",
      tags: ["jokes", "entertainment", "fun", "humor", "random"],
      output: {
        mimeType: "application/json",
        example: { joke: "I told my computer I needed a break — it said no problem, it'll go to sleep." },
        schema: {
          type: "object",
          properties: { joke: { type: "string", description: "A random interesting joke" } },
          required: ["joke"],
        },
      },
    }),
  },
}

// --- The actual resource --------------------------------------------------------

const JOKES = [
  "I told my computer I needed a break — it said no problem, it'll go to sleep.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "Parallel lines have so much in common. It's a shame they'll never meet.",
  "I would tell you a UDP joke, but you might not get it.",
  "There are 10 kinds of people in the world: those who understand binary and those who don't.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "I used to play piano by ear, but now I use my hands.",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
]

async function handler(_request: NextRequest) {
  const joke = JOKES[Math.floor(Math.random() * JOKES.length)]
  return NextResponse.json({
    joke,
    paidWith: "x402 / USDC on Base",
    source: "Random Joke API",
  })
}

// Protect the GET route behind x402. Unpaid requests get HTTP 402 with a valid
// payment-requirements challenge (including the builder-code extension); valid
// payments settle through the CDP facilitator and return the joke JSON.
export const GET = async (request: NextRequest) => {
  try {
    const server = getResourceServer()
    return withX402(handler, routeConfig, server)(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[x402] Request failed:", message)
    return NextResponse.json(
      {
        error: "Service Unavailable",
        message: message,
        details: "Failed to initialize payment service. Please check CDP credentials.",
      },
      { status: 503 }
    )
  }
}
