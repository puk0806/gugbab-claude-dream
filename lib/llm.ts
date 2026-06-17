import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { getChatSystemPrompt } from "./prompts";

const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_TOKENS = 2048;
const TEMPERATURE = 0.7;

const SAFETY_SETTINGS = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
];

export function getChatStream(messages: Array<{ role: "user" | "model"; content: string }>) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return ai.models.generateContentStream({
        model: MODEL_ID,
        config: {
            systemInstruction: getChatSystemPrompt(),
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_TOKENS,
            safetySettings: SAFETY_SETTINGS,
        },
        contents: messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
        })),
    });
}

export function getModelId(): string {
    return MODEL_ID;
}
