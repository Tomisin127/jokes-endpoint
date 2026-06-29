import { type NextRequest, NextResponse } from "next/server"
import { withX402 } from "@x402/next"
import { declareBuilderCodeExtension } from "@x402/extensions/builder-code"
import { declareDiscoveryExtension } from "@x402/extensions/bazaar"
import { resourceServer, BASE_MAINNET, PAY_TO_ADDRESS, PRICE, BUILDER_CODE } from "@/lib/x402"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Random jokes for the endpoint response.
 */
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

/**
 * The actual fulfillment. This only runs after the x402 payment has been
 * verified and settled on Base mainnet, so we can safely return the joke.
 */
async function handler(_request: NextRequest) {
  const joke = JOKES[Math.floor(Math.random() * JOKES.length)]
  return NextResponse.json({
    joke,
    paidWith: "x402 / USDC on Base",
    source: "Random Joke API",
  })
}

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      network: BASE_MAINNET,
      payTo: PAY_TO_ADDRESS,
      price: PRICE,
    },
    description: "Get a random interesting joke. Secured with x402 payment protocol on Base mainnet.",
    mimeType: "application/json",
    serviceName: "Random Joke API",
    tags: ["jokes", "entertainment", "fun", "humor"],
    // ERC-8021 Builder Code attribution ("a" app code) on every settlement.
    extensions: {
      ...declareBuilderCodeExtension(BUILDER_CODE),
      // Bazaar discovery metadata: tells agents how to call this endpoint.
      ...declareDiscoveryExtension({
        output: {
          example: {
            joke: "I told my computer I needed a break — it said no problem, it'll go to sleep.",
            paidWith: "x402 / USDC on Base",
            source: "Random Joke API",
          },
        },
      }),
    },
  },
  resourceServer,
)
