import { NextResponse } from "next/server";
import { RequestBodyTooLargeError } from "@/lib/bounded-form-data";
import {
  MAX_TRANSCRIBE_BYTES,
  TranscribeError,
  extensionForContentType,
  readBodyWithinLimit,
  transcribeAudio,
} from "@/lib/transcribe";

export const runtime = "nodejs";

// POST /api/transcribe
// Body: raw recorded audio (audio/webm, audio/ogg, audio/mp4, ...).
// Transcribes it locally through scripts/transcribe-audio.mjs and returns
// { text }. See docs/voice-input.md.
export async function POST(request: Request) {
  try {
    const body = await readBodyWithinLimit(request, MAX_TRANSCRIBE_BYTES);
    const result = await transcribeAudio(
      body,
      extensionForContentType(request.headers.get("content-type")),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: `Recording exceeds ${Math.round(MAX_TRANSCRIBE_BYTES / (1024 * 1024))} MB` },
        { status: 413 },
      );
    }
    if (error instanceof TranscribeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
