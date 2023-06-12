import { IncomingMessage } from "http";
import {
  Configuration,
  CreateCompletionRequest,
  CreateChatCompletionResponse,
  OpenAIApi,
} from "openai";

// This file contains utility functions for interacting with the OpenAI API

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
export const openai = new OpenAIApi(configuration);

type CompletionOptions = Partial<CreateCompletionRequest> & {
  prompt: string;
  fallback?: string;
};

type EmbeddingOptions = {
  input: string | string[];
  model?: string;
};

export async function completion({
  prompt,
  fallback,
}: CompletionOptions) {
  try {
    const result = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{role: "user", content: prompt}],
      temperature: 0,
    });

    if (!result.data.choices[0].message?.content) {
      throw new Error("No text returned from the completions endpoint.");
    }
    return result.data.choices[0].message?.content;
  } catch (error) {
    if (fallback) return fallback;
    else throw error;
  }
}

export async function* completionStream({
  prompt,
  fallback,
}: CompletionOptions) {
  try {
    const result = await openai.createChatCompletion(
      {
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: prompt}],
        temperature: 0,
      },
      { responseType: "stream" }
    );
    
    const stream = result.data as any as IncomingMessage;
    let accumulatedData = "";
    for await (const chunk of stream) {
      const line = chunk.toString().trim();
      accumulatedData += line;
    
      // Check if the accumulated data is a complete JSON object
      if (accumulatedData.endsWith("}")) {
        const data = JSON.parse(accumulatedData) as CreateChatCompletionResponse;
        yield data.choices[0].message?.content;
    
        // Reset accumulatedData for the next JSON object
        accumulatedData = "";
      } else {
        console.log("Accumulating data:", line);
      }
    }
  } catch (error) {
    if (fallback) yield fallback;
    else throw error;
  }
}

export async function embedding({
  input,
  model = "text-embedding-ada-002",
}: EmbeddingOptions): Promise<number[][]> {
  const result = await openai.createEmbedding({
    model,
    input,
  });

  if (!result.data.data[0].embedding) {
    throw new Error("No embedding returned from the completions endpoint");
  }

  // Otherwise, return the embeddings
  return result.data.data.map((d) => d.embedding);
}
