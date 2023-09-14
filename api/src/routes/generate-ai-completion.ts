import { FastifyInstance } from "fastify";
import { z } from "zod"
import { openai } from "../lib/openai";
import { prisma } from "../lib/prisma";
import { streamToResponse, OpenAIStream } from 'ai'

export async function generateAiCompletionRoute(app: FastifyInstance) {
    app.post('/ai/complete', async (request, reply) => {
        const bodySchema = z.object({
            temperature: z.number().min(0).max(1).default(0.5),
            prompt: z.string(),
            videoId: z.string().uuid(),
        })

        const { temperature, prompt, videoId } = bodySchema.parse(request.body)

        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId
            }
        })

        if (!video.transcription) {
            return reply.status(400).send({ error: 'Video transcription was not generated yet.' })
        }

        const promptMessage = prompt.replace('{transcription}', video.transcription)

        const response = await openai.chat.completions.create({
            // model:'gpt-3.5-turbo-16k', // Usar esse caso a transcrição seja bem grande
            model: 'gpt-3.5-turbo',
            temperature,
            messages: [{ role: 'user', content: promptMessage }],
            stream: true
        })

        const stream = OpenAIStream(response)

        streamToResponse(stream, reply.raw, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
        })
    })
}
