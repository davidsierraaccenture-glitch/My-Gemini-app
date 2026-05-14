import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const model = "gemini-3-flash-preview";

export async function generateGeminiChatResponse(message: string, history: { role: 'user' | 'model', content: string }[]) {
  try {
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: "You are a helpful AI assistant. Your goal is to provide concise and accurate information.",
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      }))
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function* streamGeminiChatResponse(message: string, history: { role: 'user' | 'model', content: string }[]) {
  try {
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: "You are a helpful AI assistant. Your goal is to provide concise and accurate information.",
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      }))
    });

    const result = await chat.sendMessageStream({ message });
    for await (const chunk of result) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Gemini API Streaming Error:", error);
    throw error;
  }
}
