import type { NextApiRequest, NextApiResponse } from "next";

import { completionStream } from "../../services/openai";
import { FileChunk } from "../../types/file";

type Data = {
  answer?: string;
  error?: string;
};

const MAX_FILES_LENGTH = 3000 * 3;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // Only accept POST requests
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const fileChunks = req.body.fileChunks as FileChunk[];

  const question = req.body.question as string;

  if (!Array.isArray(fileChunks)) {
    res.status(400).json({ error: "fileChunks must be an array" });
    return;
  }

  if (!question) {
    res.status(400).json({ error: "question must be a string" });
    return;
  }

  try {
    const filesString = fileChunks
        .map((fileChunk, index) => `###\n${index + 1}. "${fileChunk.filename}"\n${fileChunk.text}`)
        .join("\n")
        .slice(0, MAX_FILES_LENGTH);

    const chalk = require('chalk');
    console.log(chalk.green('Question:'), question);

    const prompt =
    `Answer the question based on the content of the provided files below. Do NOT miss any information from the provided files below. Use line breaks to improve readability.Bold the key word.\n\n` +
    `You will bold the relevant parts of the responses to improve readability.\n\n` +
    `##Question: ${question}##\n\n` +
    `Files:\n${filesString}\n\n` +
    `Answer in Markdown:`;

    const stream = completionStream({
      prompt,
      model: "gpt-3.5-turbo",
    });

    // Set the response headers for streaming
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    // Write the data from the stream to the response
    for await (const data of stream) {
      res.write(data);
    }
    res.write('\n\nSource:\n\n');
    console.log(filesString);
    res.write(filesString);
    console.log(chalk.red('This is the end of the Question'));
    console.log(chalk.red('------------------'));
    
    // End the response when the stream is done
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
    return;
  }
}
