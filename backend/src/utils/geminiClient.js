import { GoogleGenAI } from '@google/genai';
import { ApiError } from './apiError.js';

const retryDelays = [2000, 5000, 10000, 20000];

const cleanJson = (text) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new ApiError(499, 'CANCELLED', 'Generation cancelled.'));
      },
      { once: true }
    );
  });

const isRetryable = (error) =>
  [429, 500, 502, 503, 504].includes(error?.status || error?.code) ||
  /rate|busy|unavailable|overloaded/i.test(error?.message || '');

export async function generateJson({ prompt, schema, signal }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, 'LLM_NOT_CONFIGURED', 'GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let lastError;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      if (signal?.aborted) throw new ApiError(499, 'CANCELLED', 'Generation cancelled.');

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2
        }
      });

      const text = response.text;
      if (!text) throw new Error('Model returned an empty response.');

      return JSON.parse(cleanJson(text));
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === retryDelays.length) break;

      const jitter = Math.floor(Math.random() * 350);
      await sleep(retryDelays[attempt] + jitter, signal);
    }
  }

  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(502, 'LLM_GENERATION_FAILED', 'The language model could not produce valid structured output.');
}