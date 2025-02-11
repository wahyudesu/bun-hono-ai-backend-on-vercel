import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { handle } from 'hono/vercel'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const app = new Hono()

app.use(logger())
app.use(cors())

// Schema input
const requestSchema = z.object({
  topic: z.string(),
  number_question: z.number().min(1).max(10),
})

// Schema output
const outputSchema = z.array(
  z.object({
    question: z.string(),
    options: z.array(z.string()).length(4), // Pastikan selalu ada 4 opsi
    correctAnswer: z.string(),
  })
)

// Global error handling middleware
app.onError((err, c) => {
  console.error('Error:', err)

  if (err instanceof z.ZodError) {
    return c.json({ error: 'Validation error', details: err.errors }, 400)
  }
  if (err.message.includes('API key')) {
    return c.json({ error: 'API key error', message: 'Invalid or missing GROQ_API_KEY.' }, 401)
  }
  return c.json({ error: 'Internal server error', message: 'Unexpected error occurred.' }, 500)
})

// Root route
app.get('/', (c) => {
  return c.json({ message: "Congrats! You've deployed Hono to Vercel" })
})

// API endpoint to generate questions
app.post('/ai/quiz', zValidator('json', requestSchema), async (c) => {
  const { topic, number_question } = c.req.valid('json')
  const { GROQ_API_KEY } = env<{ GROQ_API_KEY: string }>(c)

  if (!GROQ_API_KEY) {
    return c.json({ error: 'Missing GROQ_API_KEY' }, 401)
  }

  const groq = createGroq({ apiKey: GROQ_API_KEY })

  try {
    const { object } = await generateObject({
      model: groq("gemma2-9b-it"),
      schema: outputSchema,
      prompt: `Buatkan ${number_question} soal pilihan ganda tentang ${topic} berbahasa Indonesia. 
               Setiap soal memiliki 4 opsi jawaban, dan satu jawaban yang benar.`,
    })

    return c.json(object)
  } catch (error) {
    console.error('AI Error:', error)
    return c.json({ error: 'Failed to generate quiz questions' }, 500)
  }
})

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const OPTIONS = handler
