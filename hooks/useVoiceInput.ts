"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyRecorderError,
  classifyTranscribeResponse,
  pickRecorderMimeType,
  type VoiceInputError,
} from "@/lib/voice-input";

export type VoiceInputState = "idle" | "recording" | "transcribing";

export interface VoiceTranscript {
  text: string;
  language: string;
  durationSeconds: number;
}

interface Options {
  /**
   * Called with the transcribed text. The composer decides where it lands, so
   * the hook stays free of caret and draft concerns.
   */
  onTranscript: (transcript: VoiceTranscript) => void;
}

/**
 * Records microphone audio in the browser and asks /api/transcribe to
 * transcribe it with the local model. The model handles a recording only after
 * it stops (it does not support streaming), so this is a two-click flow:
 * start recording, stop and insert the text.
 */
export function useVoiceInput({ onTranscript }: Options) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [error, setError] = useState<VoiceInputError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef(onTranscript);

  useEffect(() => {
    transcriptRef.current = onTranscript;
  }, [onTranscript]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Drop the handlers first so teardown never uploads a half recording.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.stop();
    }
    releaseStream();
  }, [releaseStream]);

  // Elapsed time is only needed for the recording indicator.
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(timer);
  }, [state]);

  const start = useCallback(async () => {
    setError(null);

    if (
      typeof navigator === "undefined"
      || !navigator.mediaDevices?.getUserMedia
      || typeof MediaRecorder === "undefined"
    ) {
      setError({ code: "unsupported" });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (failure) {
      setError({
        code: classifyRecorderError(
          failure instanceof DOMException ? failure.name : undefined,
        ),
      });
      return;
    }

    const mimeType = pickRecorderMimeType((type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError({ code: "failed" });
      return;
    }
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    setElapsedMs(0);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      releaseStream();
      setState("idle");
      setError({ code: "failed" });
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      chunksRef.current = [];
      releaseStream();

      if (blob.size === 0) {
        setState("idle");
        setError({ code: "empty" });
        return;
      }

      setState("transcribing");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": blob.type || "application/octet-stream" },
          body: blob,
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          setError({
            code: classifyTranscribeResponse(response.status),
            message: typeof detail?.error === "string" ? detail.error : undefined,
          });
          return;
        }
        const result = await response.json();
        const text = typeof result?.text === "string" ? result.text : "";
        if (!text.trim()) {
          setError({ code: "empty" });
          return;
        }
        transcriptRef.current({
          text,
          language: "",
          durationSeconds: 0,
        });
      } catch (failure) {
        if (controller.signal.aborted) return;
        setError({
          code: "failed",
          message: failure instanceof Error ? failure.message : undefined,
        });
      } finally {
        abortRef.current = null;
        setState("idle");
      }
    };

    recorder.start();
    setState("recording");
  }, [releaseStream]);
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      setState("idle");
      return;
    }
    recorder.stop();
  }, [releaseStream]);

  const clearError = useCallback(() => setError(null), []);

  return { state, error, elapsedMs, start, stop, clearError };
}
