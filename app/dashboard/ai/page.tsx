"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Camera, CameraOff, Mic, MicOff, Monitor, CheckCircle2,
  AlertTriangle, ArrowRight, ChevronDown, ChevronRight,
  Download, RefreshCw, Clock, Volume2, Shield, Video,
  AlertOctagon, Activity, LogOut, FileText, Loader2, Check, X
} from "lucide-react";
import { toast } from "sonner";
import { InterviewConfiguration } from "@/src/components/Dashboard/InterviewConfiguration";
import { useAuth } from "@/src/components/providers/AuthProvider";
import type { InterviewContext, AIInterviewSession, AIQuestion, AIInterviewReport } from "@/src/types";
import { InterviewReportView } from "@/src/components/Report/InterviewReportView";
import { formatToUnifiedReport } from "@/src/lib/reportFormatter";

type ViewType = "config" | "setup" | "permissions" | "generating" | "lobby" | "in_progress" | "completed" | "report";
type InterviewerState = "idle" | "speaking" | "listening" | "thinking";

export default function AIInterviewPage() {
  const { user: authUser } = useAuth();
  const [view, setView] = useState<ViewType>("config");
  const [user, setUser] = useState<any>(null);
  const [context, setContext] = useState<InterviewContext | null>(null);

  // Session States
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AIInterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AIQuestion | null>(null);
  const [violations, setViolations] = useState<{ type: string; timestamp: string }[]>([]);
  const [warningModal, setWarningModal] = useState<{ type: "tab" | "fullscreen" | "screenshare"; count?: number } | null>(null);

  // Device & Stream States
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Permission Checklists
  const [perms, setPerms] = useState({
    camera: false,
    mic: false,
    screen: false
  });
  const [systemChecked, setSystemChecked] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Speech & Interviewer States
  const [interviewerState, setInterviewerState] = useState<InterviewerState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Live Timer
  const [interviewTime, setInterviewTime] = useState(0);

  // Report Navigation
  const [reportTab, setReportTab] = useState<"overview" | "questions" | "skills" | "transcript" | "proctor">("overview");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  // Refs for Video Elements & Deepgram STT/TTS
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const deepgramRecorderRef = useRef<MediaRecorder | null>(null);
  const finalizedTranscriptRef = useRef<string>("");
  const liveTranscriptRef = useRef<string>("");
  const shouldListenRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const usingDeepgramRef = useRef(false);
  const isMutedRef = useRef(false);
  const lastTabViolationRef = useRef(0);
  const interviewStartedRef = useRef(false);
  const startingSessionRef = useRef(false);
  const readyFirstQuestionRef = useRef<AIQuestion | null>(null);
  const ttsRequestIdRef = useRef(0);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAnswerSubmitRef = useRef<((endEarly?: boolean) => Promise<void>) | null>(null);
  const interviewerStateRef = useRef<InterviewerState>("idle");
  const isSubmittingRef = useRef(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const screenGraceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const screenGraceCountdownRef = useRef<number>(30);
  const [screenGraceSeconds, setScreenGraceSeconds] = useState(30);

  // Initialize and load context
  useEffect(() => {
    if (authUser) {
      setUser({ $id: authUser.$id, name: authUser.name, email: authUser.email });
    }
  }, [authUser]);

  // Keep mic stream ref in sync for Deepgram callbacks
  useEffect(() => {
    micStreamRef.current = micStream;
  }, [micStream]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    interviewerStateRef.current = interviewerState;
  }, [interviewerState]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // Bind camera preview streams
  useEffect(() => {
    if (localVideoRef.current && cameraStream) {
      localVideoRef.current.srcObject = cameraStream;
    }
    if (lobbyVideoRef.current && cameraStream) {
      lobbyVideoRef.current.srcObject = cameraStream;
    }
    if (liveVideoRef.current && cameraStream && !isCamOff) {
      liveVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, view, isCamOff]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const querySessionId = params.get("sessionId");
      if (querySessionId) {
        setSessionId(querySessionId);
        recoverSession(querySessionId);
        return;
      }

      const queryFullId = params.get("fullSessionId");
      if (queryFullId) {
        fetch(`/api/interview/session?sessionId=${queryFullId}`)
          .then(res => res.json())
          .then(data => {
            if (data.session) {
              const fullSess = data.session;
              if (fullSess.status === "completed") {
                window.location.href = `/dashboard/interview?sessionId=${queryFullId}`;
                return;
              }
              if (fullSess.aiSessionId) {
                window.location.href = `/dashboard/ai?sessionId=${fullSess.aiSessionId}&fullSessionId=${queryFullId}`;
                return;
              }
              const ctx: InterviewContext = {
                source: "role",
                role: fullSess.blueprint.role,
                jd: {
                  experience: "Mid level",
                  requiredSkills: fullSess.blueprint.skills || [],
                  preferredSkills: []
                }
              };
              localStorage.setItem("interview_context_ai", JSON.stringify(ctx));
              setContext(ctx);
              // Skip review — go straight to device permissions for E2E continuity
              setView("permissions");
            }
          })
          .catch(err => console.error(err));
        return;
      }
    }

    // Direct access without sessionId or fullSessionId: start fresh interview configuration
    localStorage.removeItem("active_ai_interview_id");
    localStorage.removeItem("interview_context_ai");
    setSessionId(null);
    setSession(null);
    setContext(null);
    setView("config");
  }, []);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      stopStreams();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const stopStreams = () => {
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setMicStream(null);
    setScreenStream(null);
    micStreamRef.current = null;

    // Stop Deepgram STT + TTS
    shouldListenRef.current = false;
    usingDeepgramRef.current = false;

    if (deepgramSocketRef.current) {
      try {
        deepgramSocketRef.current.onclose = null;
        deepgramSocketRef.current.close();
      } catch (e) { }
      deepgramSocketRef.current = null;
    }
    if (deepgramRecorderRef.current) {
      try {
        if (deepgramRecorderRef.current.state !== "inactive") {
          deepgramRecorderRef.current.stop();
        }
      } catch (e) { }
      deepgramRecorderRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
  };

  const handleExit = () => {
    const activeViews = ["permissions", "lobby", "in_progress"];
    if (activeViews.includes(view)) {
      const confirmExit = window.confirm(
        "Are you sure you want to exit the interview? Your current session progress will be cleared and reset."
      );
      if (!confirmExit) return;
    }

    try {
      if (recorder) recorder.stop();
    } catch (e) { }

    try {
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    } catch (e) { }
    stopStreams();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error("Error exiting fullscreen:", err);
      });
    }

    localStorage.removeItem("active_ai_interview_id");
    localStorage.removeItem("interview_context_ai");
    setSessionId(null);
    setSession(null);
    setContext(null);
    setView("config");

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fId = params.get("fullSessionId");
      if (fId) {
        window.location.href = `/dashboard/interview?sessionId=${fId}`;
        return;
      }
    }
    window.location.href = "/dashboard";
  };

  // Recover active session
  const recoverSession = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-interview/session?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        const activeSession = data.session as AIInterviewSession;
        if (activeSession) {
          setSession(activeSession);
          setSessionId(activeSession.id);
          if (activeSession.status === "completed") {
            setView("completed");
          } else if (activeSession.status === "in_progress" || activeSession.status === "not_started") {
            // Restore question — re-run permissions so media tracks are fresh
            const lastQuestion =
              activeSession.questions[activeSession.currentQuestionIndex] ||
              activeSession.questions[activeSession.questions.length - 1];
            setCurrentQuestion(lastQuestion);
            setView("permissions");
          }
        }
      }
    } catch (err) {
      console.error("Failed to recover session:", err);
    }
  };

  // Permissions requesting
  const requestDevices = async () => {
    try {
      // 1. Camera & Mic request
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });

      setCameraStream(new MediaStream([stream.getVideoTracks()[0]]));
      setMicStream(new MediaStream([stream.getAudioTracks()[0]]));
      micStreamRef.current = new MediaStream([stream.getAudioTracks()[0]]);

      setPerms(prev => ({ ...prev, camera: true, mic: true }));
      toast.success("Camera and Microphone connected.");
    } catch (err) {
      console.error("Device permission error:", err);
      toast.error("Failed to access camera/microphone. Please allow browser permissions.");
    }
  };

  const requestScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setScreenStream(stream);
      setPerms(prev => ({ ...prev, screen: true }));
      toast.success("Screen sharing enabled.");

      // Bind track ended event (Proctoring)
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        handleScreenShareInterrupted();
      };
    } catch (err) {
      console.error("Screen share permission error:", err);
      toast.error("Screen share is required to proceed with the interview.");
    }
  };

  const triggerDiagnosticCheck = () => {
    if (!perms.camera || !perms.mic || !perms.screen) {
      toast.error("Please grant all permissions first.");
      return;
    }
    setSystemChecked(true);
    toast.success("All systems diagnostics are stable.");
  };

  /** Pre-generate all questions, then enter the lobby countdown. */
  const prepareAndStartInterview = async () => {
    if (!context || !user) return;
    if (startingSessionRef.current) return;
    startingSessionRef.current = true;

    try {
      setView("generating");
      const res = await fetch("/api/ai-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          userId: user.$id
        })
      });

      if (!res.ok) throw new Error("Failed to start session.");
      const data = await res.json();

      setSession(data.session);
      setSessionId(data.sessionId);
      setCurrentQuestion(data.session.questions[0]);
      readyFirstQuestionRef.current = data.session.questions[0];
      localStorage.setItem("active_ai_interview_id", data.sessionId);

      startCountdown();
    } catch (err) {
      startingSessionRef.current = false;
      toast.error("Failed to generate interview questions. Please try again.");
      setView("permissions");
    }
  };

  const startCountdown = () => {
    setView("lobby");
    setCountdown(5);
    interviewStartedRef.current = false;

    // Bind webcam preview to lobby preview
    setTimeout(() => {
      if (lobbyVideoRef.current && cameraStream) {
        lobbyVideoRef.current.srcObject = cameraStream;
      }
    }, 100);

    // Use a local counter — React Strict Mode can double-invoke setState updaters
    let remaining = 5;
    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(interval);
        if (!interviewStartedRef.current) {
          interviewStartedRef.current = true;
          enterFullscreenAndStart();
        }
      }
    }, 1000);
  };

  // Fullscreen implementation
  const enterFullscreenAndStart = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request rejected:", err);
    }

    // Start session recording
    startRecording();

    // Start timer (clear any previous)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setInterviewTime(0);
    timerIntervalRef.current = setInterval(() => {
      setInterviewTime(prev => prev + 1);
    }, 1000);

    // Questions are already pre-generated — enter live room immediately
    const firstQ = readyFirstQuestionRef.current;
    setView("in_progress");
    if (firstQ) {
      setCurrentQuestion(firstQ);
      setTimeout(() => triggerAIVoice(firstQ.questionText), 1000);
    }
  };

  const initializeSessionAPI = async () => {
    // Kept for resume paths that still need a fresh session
    await prepareAndStartInterview();
  };

  // Web Recording
  const startRecording = () => {
    if (!cameraStream || !screenStream) return;
    try {
      const combinedTracks = [
        ...cameraStream.getVideoTracks(),
        ...screenStream.getVideoTracks()
      ];
      // Try to append audio if available
      if (micStream && micStream.getAudioTracks().length > 0) {
        combinedTracks.push(micStream.getAudioTracks()[0]);
      }

      const combinedStream = new MediaStream(combinedTracks);
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm;codecs=vp9,opus" });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
      };

      mediaRecorder.start(1000);
      setRecorder(mediaRecorder);
    } catch (e) {
      console.warn("MediaRecorder creation error, trying simple webcam recorder:", e);
      // Fallback: record just the webcam
      try {
        const tracks = [...cameraStream.getVideoTracks()];
        if (micStream) tracks.push(micStream.getAudioTracks()[0]);
        const stream = new MediaStream(tracks);
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          setVideoUrl(URL.createObjectURL(blob));
        };
        mediaRecorder.start(1000);
        setRecorder(mediaRecorder);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    }
  };

  // Silence detection — auto-submit after ~5.5s pause (same as audio interview)
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const resetSilenceTimer = () => {
    clearSilenceTimer();
    const state = interviewerStateRef.current;
    if (
      state === "speaking" ||
      state === "thinking" ||
      isMutedRef.current ||
      isSubmittingRef.current ||
      !shouldListenRef.current
    ) {
      return;
    }
    silenceTimerRef.current = setTimeout(() => {
      const transcript = liveTranscriptRef.current.trim();
      if (transcript.length > 0 && handleAnswerSubmitRef.current) {
        console.log("Auto-submitting answer due to silence:", transcript);
        handleAnswerSubmitRef.current(false);
      }
    }, 5500);
  };

  const updateLiveTranscript = (val: string) => {
    liveTranscriptRef.current = val;
    setLiveTranscript(val);
    if (val && val.trim().length > 0) {
      resetSilenceTimer();
    } else {
      clearSilenceTimer();
    }
  };

  // Deepgram STT — same working approach as audio interview module
  const startDeepgramRecognition = async (): Promise<boolean> => {
    try {
      // Close any existing socket/recorder first
      if (deepgramSocketRef.current) {
        try {
          deepgramSocketRef.current.onclose = null;
          deepgramSocketRef.current.close();
        } catch (e) { }
        deepgramSocketRef.current = null;
      }
      if (deepgramRecorderRef.current) {
        try {
          if (deepgramRecorderRef.current.state !== "inactive") {
            deepgramRecorderRef.current.stop();
          }
        } catch (e) { }
        deepgramRecorderRef.current = null;
      }

      const tokenRes = await fetch("/api/deepgram/token");
      if (!tokenRes.ok) {
        toast.error("Failed to get Deepgram token for transcription.");
        return false;
      }

      const { token } = await tokenRes.json();
      if (!token) {
        toast.error("Deepgram token missing. Check DEEPGRAM_API_KEY.");
        return false;
      }

      const ws = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&punctuate=true",
        ["token", token]
      );
      deepgramSocketRef.current = ws;

      ws.onopen = async () => {
        try {
          const stream =
            micStreamRef.current ||
            (await navigator.mediaDevices.getUserMedia({ audio: true }));

          if (!micStreamRef.current) {
            micStreamRef.current = stream;
            setMicStream(stream);
          }

          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";

          const recorder = new MediaRecorder(stream, { mimeType });
          deepgramRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(e.data);
            }
          };
          recorder.start(250);
          usingDeepgramRef.current = true;
        } catch (err) {
          console.error("Deepgram MediaRecorder start error:", err);
          toast.error("Failed to start Deepgram microphone stream.");
          usingDeepgramRef.current = false;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (!transcript) return;

          if (data.is_final) {
            finalizedTranscriptRef.current = (
              finalizedTranscriptRef.current + " " + transcript
            ).trim();
            updateLiveTranscript(finalizedTranscriptRef.current);
          } else {
            const interim = (
              finalizedTranscriptRef.current + " " + transcript
            ).trim();
            updateLiveTranscript(interim);
          }
        } catch (e) {
          console.warn("Failed to parse Deepgram message", e);
        }
      };

      ws.onerror = (err) => {
        console.error("Deepgram WebSocket error:", err);
        usingDeepgramRef.current = false;
      };

      ws.onclose = () => {
        usingDeepgramRef.current = false;
        if (shouldListenRef.current && !isMutedRef.current) {
          setTimeout(() => {
            if (shouldListenRef.current && !isMutedRef.current) {
              startDeepgramRecognition();
            }
          }, 1000);
        }
      };

      return true;
    } catch (err) {
      console.error("Deepgram STT failed:", err);
      toast.error("Deepgram speech recognition failed.");
      return false;
    }
  };

  const stopDeepgramRecognition = () => {
    usingDeepgramRef.current = false;

    if (deepgramSocketRef.current) {
      try {
        deepgramSocketRef.current.onclose = null;
        deepgramSocketRef.current.close();
      } catch (e) { }
      deepgramSocketRef.current = null;
    }

    if (deepgramRecorderRef.current) {
      try {
        if (deepgramRecorderRef.current.state !== "inactive") {
          deepgramRecorderRef.current.stop();
        }
      } catch (e) { }
      deepgramRecorderRef.current = null;
    }
  };

  // Deepgram TTS only — same pattern as audio interview module
  const triggerAIVoice = async (text: string) => {
    const requestId = ++ttsRequestIdRef.current;

    setInterviewerState("speaking");
    setIsListening(false);
    shouldListenRef.current = false;
    stopListening();

    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.pause();
      } catch (e) { }
      ttsAudioRef.current = null;
    }

    const beginListening = () => {
      // Ignore stale TTS callbacks from a superseded request
      if (requestId !== ttsRequestIdRef.current) return;
      setInterviewerState("listening");
      startListening();
    };

    try {
      const res = await fetch("/api/deepgram/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "aura-asteria-en" }),
      });

      if (requestId !== ttsRequestIdRef.current) return;

      if (!res.ok) {
        throw new Error(`Deepgram TTS failed (${res.status})`);
      }

      const blob = await res.blob();
      if (requestId !== ttsRequestIdRef.current) return;

      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        beginListening();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        toast.error("Failed to play Deepgram voice. Starting listening anyway.");
        beginListening();
      };

      await audio.play();
    } catch (err) {
      if (requestId !== ttsRequestIdRef.current) return;
      console.error("Deepgram TTS failed:", err);
      toast.error("Deepgram text-to-speech failed. Starting listening anyway.");
      beginListening();
    }
  };

  const startListening = () => {
    clearSilenceTimer();
    shouldListenRef.current = true;
    setIsListening(true);
    finalizedTranscriptRef.current = "";
    updateLiveTranscript("");

    startDeepgramRecognition().then((success) => {
      if (!success && shouldListenRef.current) {
        toast.error(
          "Could not start Deepgram live transcription. Check DEEPGRAM_API_KEY and mic permissions."
        );
        setIsListening(false);
        shouldListenRef.current = false;
      }
    });
  };

  const stopListening = () => {
    clearSilenceTimer();
    shouldListenRef.current = false;
    setIsListening(false);
    stopDeepgramRecognition();
  };

  const cleanupInterviewMedia = async () => {
    clearSilenceTimer();
    if (recorder) {
      try { recorder.stop(); } catch (e) { }
    }
    stopListening();
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      } catch (e) { }
    }
    stopStreams();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (screenGraceTimeoutRef.current) clearInterval(screenGraceTimeoutRef.current);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (e) { }
    }
    localStorage.removeItem("active_ai_interview_id");
  };

  const showFinalReport = async (completedSession: AIInterviewSession) => {
    await cleanupInterviewMedia();
    setSession(completedSession);
    setCurrentQuestion(null);
    setInterviewerState("idle");
    toast.success("Interview completed! Your report is ready.");

    // E2E: link AI round, finalize master report, return to hub results
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fId = params.get("fullSessionId");
      if (fId && completedSession.id) {
        toast.info("Finalizing full interview results...");
        try {
          await fetch("/api/interview/link-round", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullSessionId: fId,
              roundType: "ai",
              roundSessionId: completedSession.id
            })
          });
          await fetch("/api/interview/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullSessionId: fId })
          });
        } catch (e) { }
        localStorage.removeItem("interview_context_ai");
        localStorage.removeItem("active_ai_interview_id");
        setTimeout(() => {
          window.location.href = `/dashboard/interview?sessionId=${fId}`;
        }, 1200);
        return;
      }
    }

    setView("completed");
  };

  // Submit Answer & Dynamic Question generation
  const handleAnswerSubmit = async (endEarly = false) => {
    if (!sessionId || !currentQuestion || isSubmittingRef.current) return;

    clearSilenceTimer();
    stopListening();
    setInterviewerState("thinking");
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    const finalAnswer =
      (liveTranscriptRef.current || liveTranscript).trim() ||
      (endEarly ? "(Interview ended early)" : "(No verbal answer provided)");
    finalizedTranscriptRef.current = "";
    updateLiveTranscript("");

    try {
      const res = await fetch("/api/ai-interview/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          answerText: finalAnswer,
          violations,
          endInterview: endEarly
        })
      });

      if (!res.ok) throw new Error("Failed to submit response.");
      const data = await res.json();
      const updatedSession = data.session as AIInterviewSession;

      setSession(updatedSession);
      setViolations([]);

      if (updatedSession.status === "completed") {
        await showFinalReport(updatedSession);
      } else {
        const nextQ = updatedSession.questions[updatedSession.currentQuestionIndex];
        setCurrentQuestion(nextQ);
        setInterviewerState("idle");
        setTimeout(() => triggerAIVoice(nextQ.questionText), 500);
      }
    } catch (err) {
      toast.error("Failed to submit answer. Please try again.");
      setInterviewerState("listening");
      startListening();
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  handleAnswerSubmitRef.current = handleAnswerSubmit;

  // Proctoring Event Binding
  useEffect(() => {
    if (view !== "in_progress") return;

    // 1. Tab switches (Visibility API & Window Focus/Blur)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        logViolation("tab_switch");
      }
    };

    const handleWindowBlur = () => {
      logViolation("tab_switch");
    };

    // 2. Fullscreen Exit Detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && view === "in_progress") {
        logViolation("fullscreen_exit");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [view, violations, session]);

  const logViolation = (type: "tab_switch" | "fullscreen_exit" | "screen_share_interrupted") => {
    // Debounce duplicate tab-switch events (visibility + blur often fire together)
    if (type === "tab_switch") {
      const now = Date.now();
      if (now - lastTabViolationRef.current < 2000) return;
      lastTabViolationRef.current = now;
    }

    const newViolation = {
      type,
      timestamp: new Date().toLocaleTimeString()
    };

    setViolations(prev => {
      const next = [...prev, newViolation];

      // Calculate total warning indexes
      const allPrevViolations = session?.violations || [];
      const totalViolationsOfType = allPrevViolations.filter(v => v.type === type).length + next.filter(v => v.type === type).length;

      if (type === "tab_switch") {
        if (totalViolationsOfType >= 5) {
          // Terminate
          toast.error("Interview terminated due to excessive tab-switch violations.");
          handleEndInterview(true);
        } else {
          setWarningModal({ type: "tab", count: totalViolationsOfType });
        }
      } else if (type === "fullscreen_exit") {
        setWarningModal({ type: "fullscreen" });
      }

      return next;
    });
  };

  const handleScreenShareInterrupted = () => {
    setWarningModal({ type: "screenshare" });
    screenGraceCountdownRef.current = 30;
    setScreenGraceSeconds(30);

    screenGraceTimeoutRef.current = setInterval(() => {
      screenGraceCountdownRef.current -= 1;
      setScreenGraceSeconds(screenGraceCountdownRef.current);
      if (screenGraceCountdownRef.current <= 0) {
        clearInterval(screenGraceTimeoutRef.current!);
        toast.error("Screen sharing was not restored. Ending interview.");
        handleEndInterview(true);
      }
    }, 1000);
  };

  const resumeScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      if (screenGraceTimeoutRef.current) clearInterval(screenGraceTimeoutRef.current);
      setScreenStream(stream);
      setWarningModal(null);
      toast.success("Screen sharing restored successfully.");

      // Re-bind track onended
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        handleScreenShareInterrupted();
      };
    } catch (err) {
      toast.error("Failed to re-share screen. Please try again.");
    }
  };

  const requestReFullscreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      }
      setWarningModal(null);
    } catch (err) {
      toast.error("Failed to enter fullscreen. Please double click page.");
    }
  };

  // Ending the interview (leave early / violations) — always produce a report
  const handleEndInterview = async (blocked = false) => {
    const fId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("fullSessionId")
        : null;

    if (!sessionId) {
      await cleanupInterviewMedia();
      if (fId) {
        try {
          await fetch("/api/interview/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullSessionId: fId }),
          });
        } catch {}
        window.location.href = `/dashboard/interview?sessionId=${fId}`;
        return;
      }
      setView("config");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/ai-interview/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion?.id || session?.questions?.[session.questions.length - 1]?.id || "q-1",
          answerText: blocked
            ? "(Forcefully Terminated - Violation Limit Exceeded)"
            : ((liveTranscriptRef.current || liveTranscript).trim() || "(Interview ended early)"),
          violations,
          endInterview: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (blocked) toast.error("Interview completed with violations.");
        await showFinalReport(data.session as AIInterviewSession);
        return;
      }
    } catch (err) {
      console.error("Failed to finalize AI interview:", err);
    } finally {
      setIsSubmitting(false);
    }

    // Fallback: still leave the live room even if finalize fails
    await cleanupInterviewMedia();
    setView("completed");
  };

  const handleResetAll = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fId = params.get("fullSessionId");
      if (fId) {
        window.location.href = `/dashboard/interview?sessionId=${fId}`;
        return;
      }
    }
    localStorage.removeItem("active_ai_interview_id");
    localStorage.removeItem("interview_context_ai");
    localStorage.removeItem("interview_context_oa");
    setSessionId(null);
    setSession(null);
    setCurrentQuestion(null);
    setViolations([]);
    setWarningModal(null);
    setView("config");
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
  };

  // Human interviewer panel (static photo + status)
  const HumanInterviewer = ({ state }: { state: InterviewerState }) => {
    const statusLabel =
      state === "speaking"
        ? "Speaking"
        : state === "listening"
          ? "Listening"
          : state === "thinking"
            ? "Thinking"
            : "Ready";

    const statusColor =
      state === "speaking"
        ? "bg-blue-50 text-blue-700 border-blue-100"
        : state === "listening"
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : state === "thinking"
            ? "bg-amber-50 text-amber-700 border-amber-100"
            : "bg-slate-50 text-slate-600 border-slate-200";

    return (
      <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-lg border border-[#ECECEC] bg-[#F9FAFB]">
        <Image
          src="/ai-avatar.png"
          alt="AI Interviewer"
          fill
          className="object-cover object-top"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-white text-sm font-semibold tracking-tight">AI Interviewer</p>
            <p className="text-white/70 text-[11px] mt-0.5">Technical panel</p>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Speaking / listening bars */}
        <div className="absolute bottom-16 left-4 flex items-end gap-1 h-6">
          {state === "speaking"
            ? [...Array(8)].map((_, i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 0.07}s` }}
                className="w-1 rounded-full bg-blue-400 animate-[ai-talk_0.35s_ease-in-out_infinite]"
              />
            ))
            : state === "listening"
              ? [...Array(8)].map((_, i) => (
                <span
                  key={i}
                  style={{ animationDelay: `${i * 0.1}s`, height: "0.5rem" }}
                  className="w-1 rounded-full bg-emerald-400 animate-[ai-listen-pulse_1s_ease-in-out_infinite]"
                />
              ))
              : null}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-full mx-auto pb-12">
      {/* HEADER SECTION */}
      {view !== "in_progress" && view !== "lobby" && view !== "generating" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">AI Interview Round</h1>
            <p className="text-[#6B7280] mt-1 text-[13px]">
              Conduct an automated, proctored mock interview driven by dynamic GPT OSS AI feedback.
            </p>
          </div>
          <div className="flex items-center gap-2">

            {view !== "config" && (
              <button
                onClick={handleResetAll}
                className="flex items-center gap-1.5 text-xs text-[#2563EB] bg-blue-50 hover:bg-blue-100/80 px-3 py-2 rounded-lg font-medium transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fullSessionId") ? "Return to Full Interview" : "Configure New Interview"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW: CONFIGURATION STEPPER */}
      {view === "config" && (
        <InterviewConfiguration
          interviewType="ai"
          onConfigurationComplete={() => {
            const savedContext = localStorage.getItem("interview_context_ai");
            if (savedContext) {
              setContext(JSON.parse(savedContext) as InterviewContext);
              setView("setup");
            }
          }}
        />
      )}

      {/* VIEW: SETUP & CONTEXT REVIEW */}
      {view === "setup" && context && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 max-w-3xl mx-auto shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111111]">Review Interview Context</h2>
              <p className="text-xs text-[#6B7280]">Confirm candidate details before starting the AI session.</p>
            </div>
          </div>

          <div className="space-y-6 border border-[#F3F4F6] bg-[#FAFAFA] rounded-xl p-6 mb-8 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-xs font-semibold text-[#9CA3AF] block uppercase tracking-wider">Source</span>
                <span className="text-[#111111] font-medium mt-1 block">
                  {context.source === "resume" ? "Resume Upload" : context.source === "jd" ? "Job Description" : "Custom Configuration"}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#9CA3AF] block uppercase tracking-wider">Target Role</span>
                <span className="text-[#111111] font-medium mt-1 block">{context.role || "MERN Stack Developer"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#9CA3AF] block uppercase tracking-wider">Experience Level</span>
                <span className="text-[#111111] font-medium mt-1 block">
                  {context.jd?.experience || "2+ Years"}
                </span>
              </div>
            </div>

            {/* Extracted Skills */}
            <div>
              <span className="text-xs font-semibold text-[#9CA3AF] block uppercase tracking-wider mb-2">Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {(context.resume?.skills || context.jd?.requiredSkills || ["React", "TypeScript", "Node.js", "Express", "MongoDB"]).map((sk, idx) => (
                  <span key={idx} className="bg-white border border-[#E5E7EB] text-[#374151] px-2.5 py-1 rounded-md text-xs font-medium">
                    {sk}
                  </span>
                ))}
              </div>
            </div>

            {/* Extracted Projects */}
            {context.resume?.projects && context.resume.projects.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-[#9CA3AF] block uppercase tracking-wider mb-2">Projects</span>
                <ul className="space-y-2">
                  {context.resume.projects.map((p, idx) => (
                    <li key={idx} className="flex gap-2 text-xs text-[#374151] items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setView("permissions")}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition shadow-sm text-sm"
            >
              Confirm & Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW: PERMISSIONS & SYSTEM DIAGNOSTICS */}
      {view === "permissions" && (
        <div className="max-w-4xl mx-auto space-y-4">
          {typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("fullSessionId") && (
              <div className="flex items-center justify-between bg-white border border-[#ECECEC] rounded-lg px-4 py-2.5">
                <span className="text-xs font-semibold text-[#111111]">
                  Full Interview · Round 2 (AI) — permissions
                </span>
                <button
                  onClick={() => {
                    const ok = window.confirm(
                      "End the full interview now? Partial results will be finalized."
                    );
                    if (ok) void handleEndInterview(false);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3.5 py-1.5 rounded-lg"
                >
                  <LogOut className="w-3.5 h-3.5" /> End Test
                </button>
              </div>
            )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Permission Checklist */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#111111] mb-2">Allow Required Permissions</h2>
            <p className="text-xs text-[#6B7280] mb-6">
              To guarantee a fair mock evaluation, we require active hardware streams.
            </p>

            <div className="space-y-4 mb-8">
              {/* Camera */}
              <div className="flex items-start justify-between border border-[#F3F4F6] p-4 rounded-xl">
                <div className="flex gap-3">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111111]">Camera Access</h3>
                    <p className="text-[11px] text-[#6B7280]">Required for verification and live preview.</p>
                  </div>
                </div>
                {perms.camera ? (
                  <span className="flex items-center gap-1 text-[11px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-[#E11D48] font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                    Not Granted
                  </span>
                )}
              </div>

              {/* Microphone */}
              <div className="flex items-start justify-between border border-[#F3F4F6] p-4 rounded-xl">
                <div className="flex gap-3">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111111]">Microphone Access</h3>
                    <p className="text-[11px] text-[#6B7280]">Required for speech-to-text voice interaction.</p>
                  </div>
                </div>
                {perms.mic ? (
                  <span className="flex items-center gap-1 text-[11px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-[#E11D48] font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                    Not Granted
                  </span>
                )}
              </div>

              {/* Screen Share */}
              <div className="flex items-start justify-between border border-[#F3F4F6] p-4 rounded-xl">
                <div className="flex gap-3">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111111]">Screen Share</h3>
                    <p className="text-[11px] text-[#6B7280]">Required to verify active browser tab limits.</p>
                  </div>
                </div>
                {perms.screen ? (
                  <span className="flex items-center gap-1 text-[11px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-[#E11D48] font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                    Not Granted
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={requestDevices}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                Request Device Permissions
              </button>
              <button
                onClick={requestScreenShare}
                disabled={!perms.camera}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                Enable Screen Sharing
              </button>
            </div>
          </div>

          {/* System diagnostics & Video Feed */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-[#111111] mb-2">System Diagnostic</h2>
            <p className="text-xs text-[#6B7280] mb-6">Verify hardware preview streams before entering lobby.</p>

            {/* Video preview or placeholder */}
            <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden mb-6 flex items-center justify-center group shadow-inner">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!perms.camera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-900 gap-2">
                  <CameraOff className="w-8 h-8 text-slate-600 animate-pulse" />
                  <span className="text-xs">Camera preview stream offline</span>
                </div>
              )}
            </div>

            {/* Checklist items */}
            <div className="space-y-3 mb-6 flex-grow">
              <div className="flex justify-between items-center text-xs border-b border-[#F3F4F6] pb-2">
                <span className="text-[#6B7280]">Internet Connection</span>
                <span className="text-green-600 font-bold">Stable</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-[#F3F4F6] pb-2">
                <span className="text-[#6B7280]">Fullscreen Compatibility</span>
                <span className="text-green-600 font-bold">Supported</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2">
                <span className="text-[#6B7280]">Deepgram STT / TTS</span>
                <span className="text-green-600 font-bold">Ready</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={triggerDiagnosticCheck}
                className="flex-1 border border-[#D1D5DB] hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition text-sm"
              >
                Run Diagnostics
              </button>
              <button
                onClick={prepareAndStartInterview}
                disabled={!perms.camera || !perms.mic || !perms.screen || !systemChecked}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition text-sm flex items-center justify-center gap-1.5 shadow-sm"
              >
                Start Interview
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* VIEW: AI GENERATING QUESTIONS */}
      {view === "generating" && (
        <div className="max-w-xl mx-auto pt-16">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-[#111111]">AI is generating your questions</h2>
            <p className="text-sm text-[#6B7280] mt-2 max-w-md leading-relaxed">
              Building a full 10-question interview from your resume, job description, and role.
              Once ready, the live interview runs without pausing to fetch the next question.
            </p>
            <div className="mt-8 w-full max-w-sm bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 text-left space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Analyzing your profile blueprint…
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:150ms]" />
                Writing personalized technical questions…
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:300ms]" />
                Preparing the proctored interview room…
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-6">This usually takes a few seconds</p>
          </div>
        </div>
      )}

      {/* VIEW: LOBBY COUNTDOWN */}
      {view === "lobby" && (
        <div className="max-w-4xl mx-auto space-y-6 pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Interview Room Ready</h2>
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-lg transition font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> Exit Setup
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Lobby Preview Feed */}
            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center">
              <video
                ref={lobbyVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Guide Guidelines Cards */}
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col justify-end p-6 text-white">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Proctoring Guidelines
                </h3>
                <ul className="space-y-2 text-xs text-slate-200">
                  <li className="flex gap-2 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    Ensure you are in a quiet, well-lit environment.
                  </li>
                  <li className="flex gap-2 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    Keep your face clearly aligned within the camera feed.
                  </li>
                  <li className="flex gap-2 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    Tab-switching or exiting fullscreen mode is strictly monitored.
                  </li>
                  <li className="flex gap-2 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    Ensure screen sharing remains active for your entire display.
                  </li>
                </ul>
              </div>
            </div>

            {/* Large Countdown */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 shadow-sm text-center flex flex-col items-center justify-center">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 mb-2">Questions ready</span>
              <h2 className="text-xl font-bold text-[#111111] mb-6">All questions generated — starting soon</h2>

              {/* Circular Countdown Ring */}
              <div className="relative w-36 h-36 flex items-center justify-center border-4 border-slate-100 rounded-full mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                <span className="text-5xl font-black text-slate-800">{countdown}</span>
              </div>

              <p className="text-xs text-[#6B7280] leading-relaxed">
                Your personalized question set is locked in. This workspace will enter fullscreen automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: LIVE AI INTERVIEW ROOM */}
      {view === "in_progress" && currentQuestion && (
        <div className="fixed inset-0 z-50 bg-[#FAFAFA] text-[#111111] flex flex-col">

          {/* TOP BAR */}
          <header className="h-14 border-b border-[#ECECEC] px-5 lg:px-6 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-[13px] font-semibold text-[#111111]">AI Interview in Progress</span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F9FAFB] px-3 py-1.5 rounded-lg border border-[#ECECEC] text-xs font-medium text-[#6B7280]">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span>Question {(session?.currentQuestionIndex ?? 0) + 1} / {session?.questions.length || 10}</span>
            </div>

            <div className="flex items-center gap-2.5">
              {typeof window !== "undefined" &&
                new URLSearchParams(window.location.search).get("fullSessionId") && (
                <button
                  onClick={() => {
                    const ok = window.confirm(
                      "End the full interview now? Your answers so far will be used for the report."
                    );
                    if (ok) void handleEndInterview(false);
                  }}
                  className="flex items-center gap-1.5 text-xs text-rose-700 bg-white hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" /> End Test
                </button>
              )}
              <button
                onClick={handleExit}
                className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-100 transition font-medium"
              >
                <LogOut className="w-3.5 h-3.5" /> Exit
              </button>
              <div className="flex items-center gap-1.5 text-[#6B7280] font-medium text-xs bg-[#F9FAFB] px-3 py-1.5 rounded-lg border border-[#ECECEC]">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span className="font-mono text-red-600">{formatTimer(interviewTime)}</span>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col p-4 lg:p-5 gap-4 overflow-hidden min-h-0">

            {/* Video row: AI interviewer (left) + user live video (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 h-[38vh] min-h-[220px] max-h-[340px]">
              <HumanInterviewer state={interviewerState} />

              <div className="relative h-full min-h-[220px] w-full overflow-hidden rounded-lg border border-[#ECECEC] bg-[#111111]">
                {cameraStream && !isCamOff ? (
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 bg-[#1a1a1a]">
                    <CameraOff className="w-8 h-8" />
                    <span className="text-xs">Camera is off</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-white text-sm font-semibold">{user?.name || "Candidate"}</p>
                  <p className="text-white/70 text-[11px] mt-0.5">
                    {context?.role || "Interview Candidate"}
                  </p>
                </div>
                {isListening && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live
                  </div>
                )}
              </div>
            </div>

            {/* Question + Transcript */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
              {/* Question */}
              <div className="bg-white border border-[#ECECEC] rounded-lg p-5 flex flex-col overflow-y-auto">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-2">
                  {interviewerState === "speaking"
                    ? "AI is speaking..."
                    : interviewerState === "thinking"
                      ? "Saving your answer..."
                      : "Current Question"}
                </span>
                <p className="text-[15px] font-medium leading-relaxed text-[#111111]">
                  {currentQuestion.questionText}
                </p>
              </div>

              {/* Live transcript */}
              <div className="bg-white border border-[#ECECEC] rounded-lg p-5 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
                    {isListening && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />}
                    {isListening ? "Live Transcription" : "Your Answer"}
                  </span>
                  {isListening ? (
                    <button
                      onClick={() => handleAnswerSubmit(false)}
                      disabled={isSubmitting}
                      className="bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg transition text-xs flex items-center gap-1.5"
                    >
                      {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {isSubmitting ? "Submitting..." : "Submit Now"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-[#F3F4F6] text-[#9CA3AF] font-medium px-4 py-2 rounded-lg text-xs cursor-not-allowed"
                    >
                      {isSubmitting ? "Processing..." : "Auto-advances on pause"}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto rounded-md bg-[#F9FAFB] border border-[#F3F4F6] p-3 min-h-[100px]">
                  {liveTranscript ? (
                    <p className="text-sm leading-relaxed text-[#111111] whitespace-pre-wrap">
                      {liveTranscript}
                    </p>
                  ) : (
                    <p className="text-xs italic text-[#9CA3AF]">
                      {isListening
                        ? "Speak clearly — pause for ~5–6 seconds when done and we will auto-advance."
                        : interviewerState === "thinking"
                          ? "Loading the next question…"
                          : "Waiting for the interviewer to finish speaking..."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM CONTROLS */}
          <footer className="h-16 bg-white border-t border-[#ECECEC] px-5 lg:px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold border border-blue-100">
                {(user?.name || "C").charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-[#111111] leading-tight">{user?.name}</p>
                <p className="text-[10px] text-[#9CA3AF]">Candidate</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (micStream) {
                    const next = !isMuted;
                    micStream.getAudioTracks().forEach(t => { t.enabled = !next; });
                    setIsMuted(next);
                    if (next) {
                      shouldListenRef.current = false;
                      stopDeepgramRecognition();
                      setIsListening(false);
                    } else if (interviewerState === "listening") {
                      startListening();
                    }
                    toast.success(next ? "Microphone muted" : "Microphone active");
                  }
                }}
                className={`p-2.5 rounded-lg border transition ${isMuted ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-[#F9FAFB] border-[#ECECEC] text-[#374151] hover:bg-[#F3F4F6]"}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  if (cameraStream) {
                    const next = !isCamOff;
                    cameraStream.getVideoTracks().forEach(t => { t.enabled = !next; });
                    setIsCamOff(next);
                    toast.success(next ? "Camera disabled" : "Camera active");
                  }
                }}
                className={`p-2.5 rounded-lg border transition ${isCamOff ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-[#F9FAFB] border-[#ECECEC] text-[#374151] hover:bg-[#F3F4F6]"}`}
                title={isCamOff ? "Turn camera on" : "Turn camera off"}
              >
                {isCamOff ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              </button>

              <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#ECECEC] px-3 py-2 rounded-lg text-[10px] font-medium text-[#6B7280]">
                <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Screen Sharing Active</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm("Are you sure you want to leave? Your answers will be submitted for evaluation.")) {
                  handleEndInterview(false);
                }
              }}
              className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 px-3.5 py-2 rounded-lg font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave Interview
            </button>
          </footer>

          {/* WARNING MODAL OVERLAYS (PROCTORING) */}
          {warningModal && (
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">

              {warningModal.type === "tab" && (
                <div className="bg-white border border-[#ECECEC] rounded-lg p-8 max-w-md w-full shadow-xl text-center">
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center mx-auto mb-5">
                    <AlertOctagon className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#111111] mb-2">Tab Switch Detected</h2>
                  <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
                    Please stay on this tab during the interview. This is warning{" "}
                    <span className="font-semibold text-rose-600">{warningModal.count} of 5</span>.
                    Reaching 5 switches will end your session.
                  </p>
                  <button
                    onClick={() => setWarningModal(null)}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition text-sm"
                  >
                    OK, I understand
                  </button>
                </div>
              )}

              {warningModal.type === "fullscreen" && (
                <div className="bg-white border border-[#ECECEC] rounded-lg p-8 max-w-md w-full shadow-xl text-center">
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center mx-auto mb-5">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#111111] mb-2">Fullscreen Exit Detected</h2>
                  <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
                    Fullscreen mode is required to keep proctoring active for this mock interview.
                  </p>
                  <button
                    onClick={requestReFullscreen}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition text-sm"
                  >
                    Return to Fullscreen
                  </button>
                </div>
              )}

              {warningModal.type === "screenshare" && (
                <div className="bg-white border border-[#ECECEC] rounded-lg p-8 max-w-md w-full shadow-xl text-center">
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Monitor className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#111111] mb-2">Screen Share Interrupted</h2>
                  <p className="text-sm text-[#6B7280] mb-4 leading-relaxed">
                    Screen sharing stopped. Resume sharing immediately to continue.
                  </p>
                  <div className="text-3xl font-bold text-rose-600 mb-6 font-mono">
                    {screenGraceSeconds}s
                  </div>
                  <button
                    onClick={resumeScreenShare}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition text-sm"
                  >
                    Resume Screen Share
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* VIEW: INTERVIEW COMPLETED / SCORECARD */}
      {view === "completed" && session && (
        <div className="max-w-2xl mx-auto bg-white border border-[#E5E7EB] rounded-2xl p-10 shadow-sm text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-[#111111] mb-2">Interview Completed!</h2>
          <p className="text-xs text-[#6B7280] mb-8 leading-relaxed max-w-md">
            Great job! Your mock interview has been evaluated and a detailed report has been generated.
          </p>

          <div className="grid grid-cols-3 gap-6 w-full mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block tracking-wider">Total Questions</span>
              <span className="text-xl font-extrabold text-[#111111] mt-1.5 block">
                {session.report?.questionFeedback?.length || session.questions.filter(q => q.answerText).length || session.questions.length}
              </span>
            </div>
            <div className="text-center border-x border-[#E5E7EB]">
              <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block tracking-wider">Duration</span>
              <span className="text-xl font-extrabold text-[#111111] mt-1.5 block">
                {session.report?.candidateSummary.duration || "15:32"}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block tracking-wider">Overall Score</span>
              <span className="text-xl font-extrabold text-blue-600 mt-1.5 block">
                {session.evaluation?.overallScore || 0}%
              </span>
              <span className={`text-[10px] font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${
                session.evaluation?.passed
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-rose-700 bg-rose-50"
              }`}>
                {session.evaluation?.passed ? "Passed" : "Needs Practice"}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (session.report) {
                setView("report");
              } else {
                toast.error("Report is still generating. Please wait a moment.");
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition text-xs shadow-md flex items-center gap-2"
          >
            View Detailed Report
            <ArrowRight className="w-4 h-4" />
          </button>

          {!session.report && (
            <p className="text-xs text-amber-600 mt-4">
              Report data is missing for this session. Try ending the interview again from a new run.
            </p>
          )}
        </div>
      )}

      {/* VIEW: DETAILED REPORT PANEL */}
      {view === "report" && session?.report && (
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <button
              onClick={() => setView("completed")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Back to scorecard
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Print / Save PDF
            </button>
          </div>
          <InterviewReportView report={formatToUnifiedReport(session, "ai")} />
        </div>
      )}

    </div>
  );
}
