"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { InterviewConfiguration } from "@/src/components/Dashboard/InterviewConfiguration";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RefreshCw,
  Award,
  Home,
  ChevronRight,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  AlertCircle,
  User,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
  Bell,
  X,
  Briefcase,
  Users,
  Layers,
  Network,
  MessageSquare,
  UserCheck,
  Terminal,
  ShieldAlert,
  Brain,
  ListTodo,
  FileSpreadsheet,
  Download,
  Flame,
  UserRound,
  Globe,
  MoreVertical,
  Activity,
  UserCheck2,
  MessageCircle,
  LogOut,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InterviewContext,
  AudioInterviewSession,
  AudioInterviewSettings,
  AIQuestion,
  AIInterviewReport
} from "@/src/types";
import { InterviewReportView } from "@/src/components/Report/InterviewReportView";
import { formatToUnifiedReport } from "@/src/lib/reportFormatter";

type ViewState =
  | "config"
  | "setup"
  | "settings"
  | "permissions"
  | "generating"
  | "countdown"
  | "in_progress"
  | "completed"
  | "results";

type ReportSection =
  | "overview"
  | "questions"
  | "skills"
  | "transcript"
  | "proctor";

// Waveform Component
const Waveform = ({
  state,
  volume,
  barCount = 20,
  height = 80,
  color = "blue"
}: {
  state: "ai" | "listening" | "thinking" | "idle";
  volume: number;
  barCount?: number;
  height?: number;
  color?: "blue" | "green" | "grey";
}) => {
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      setTicks((t) => t + 1);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{ height: `${height}px` }} className="flex items-center justify-center gap-1 w-full">
      {[...Array(barCount)].map((_, i) => {
        let factor = 4;
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const weight = Math.cos((centerDist * Math.PI) / 2); // 1 at center, 0 at edges

        if (state === "ai") {
          factor = (Math.sin(ticks / 6 + i * 0.4) * 0.35 + 0.65) * height * 0.7 * weight;
        } else if (state === "listening") {
          if (volume > 2) {
            factor = (volume / 100) * height * 0.9 * weight * (Math.random() * 0.4 + 0.8);
          } else {
            factor = (Math.sin(ticks / 12 + i * 0.3) * 0.15 + 0.25) * height * 0.2 * weight;
          }
        } else if (state === "thinking") {
          factor = (Math.sin(ticks / 18 + i * 0.2) * 0.1 + 0.2) * height * 0.35 * weight;
        } else {
          factor = 4;
        }

        const finalHeight = Math.max(4, factor);

        return (
          <div
            key={i}
            style={{ height: `${finalHeight}px` }}
            className={cn(
              "w-[5px] rounded-full transition-all duration-75",
              color === "blue" && "bg-blue-500",
              color === "green" && "bg-emerald-500",
              color === "grey" && "bg-slate-700"
            )}
          />
        );
      })}
    </div>
  );
};

export default function AudioRoundPage() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<ViewState>("config");
  const [context, setContext] = useState<InterviewContext | null>(null);

  // Settings State
  const [settings, setSettings] = useState<AudioInterviewSettings>({
    duration: 10,
    difficulty: "Medium",
    interviewType: "Technical",
    voice: "Male",
    accent: "Indian",
    practiceMode: "Deep Technical",
  });

  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AudioInterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AIQuestion | null>(null);
  const [transcriptText, _setTranscriptText] = useState(""); // Holds full response transcription

  // UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [activeReportSection, setActiveReportSection] = useState<ReportSection>("overview");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"interviewer" | "transcript" | "commands">("interviewer");

  // Timer state for in-progress screen
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Audio / Speech Refs
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldRecognitionRunRef = useRef(false);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const deepgramRecorderRef = useRef<MediaRecorder | null>(null);
  const finalizedTranscriptRef = useRef<string>("");
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Silence Detection & Automatic Next Question trigger
  const latestTranscriptRef = useRef("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSubmitAnswerRef = useRef<any>(null);

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (isAiSpeaking || isThinking || isPaused || isMuted || isSubmitting) {
      return;
    }
    silenceTimerRef.current = setTimeout(() => {
      if (latestTranscriptRef.current && latestTranscriptRef.current.trim().length > 0) {
        console.log("Auto-submitting answer due to silence:", latestTranscriptRef.current);
        if (handleSubmitAnswerRef.current) {
          handleSubmitAnswerRef.current(false);
        }
      }
    }, 5500); // 5.5 seconds silence timeout
  };

  const setTranscriptText = (val: string) => {
    latestTranscriptRef.current = val;
    _setTranscriptText(val);
    if (val && val.trim().length > 0) {
      resetSilenceTimer();
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (isAiSpeaking || isThinking || isPaused || isMuted || isSubmitting) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  }, [isAiSpeaking, isThinking, isPaused, isMuted, isSubmitting]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const practiceTips = [
    "Speak clearly and at a moderate, conversational pace.",
    "Say 'repeat question' if you need the AI to read it again.",
    "Say 'give hint' to receive a helpful hint on the topic.",
    "Say 'skip question' if you would like to proceed directly to the next question.",
    "Say 'pause interview' or 'resume interview' to control the pace of the round.",
    "Say 'end interview' at any time to calculate your score immediately."
  ];
  const [tipIndex, setTipIndex] = useState(0);

  // Timer count effect
  useEffect(() => {
    let interval: any;
    if (view === "in_progress" && !isPaused) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, isPaused]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Load context from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const querySessionId = params.get("sessionId");
      if (querySessionId) {
        setSessionId(querySessionId);
        loadSession(querySessionId);
        return;
      }

      const queryFullId = params.get("fullSessionId");
      if (queryFullId) {
        fetch(`/api/interview/session?sessionId=${queryFullId}`)
          .then(res => res.json())
          .then(data => {
            if (data.session) {
              const fullSess = data.session;
              if (fullSess.audioSessionId) {
                window.location.href = `/dashboard/audio?sessionId=${fullSess.audioSessionId}&fullSessionId=${queryFullId}`;
              } else {
                const ctx: InterviewContext = {
                  source: "role",
                  role: fullSess.blueprint.role,
                  jd: {
                    experience: "Mid level",
                    requiredSkills: fullSess.blueprint.skills || [],
                    preferredSkills: []
                  }
                };
                localStorage.setItem("interview_context_audio", JSON.stringify(ctx));
                setContext(ctx);
                setView("setup");
              }
            }
          })
          .catch(err => console.error(err));
        return;
      }
    }

    // Direct access without sessionId or fullSessionId: start fresh interview configuration
    localStorage.removeItem("active_audio_session_id");
    localStorage.removeItem("interview_context_audio");
    setSessionId(null);
    setSession(null);
    setContext(null);
    setView("config");
  }, []);

  // Tip slider
  useEffect(() => {
    if (view === "countdown") {
      const interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % practiceTips.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [view]);

  // Load session from database
  const loadSession = async (id: string) => {
    try {
      setIsGenerating(true);
      const res = await fetch(`/api/audio-interview/session?sessionId=${id}`);
      if (!res.ok) throw new Error("Failed to fetch session.");
      const data = await res.json();

      const activeSession = data.session as AudioInterviewSession;
      setSession(activeSession);
      setSettings(activeSession.settings);

      if (activeSession.status === "completed") {
        setView("results");
      } else {
        const currentQ = activeSession.questions[activeSession.currentQuestionIndex];
        setCurrentQuestion(currentQ || null);
        setView("in_progress");
        shouldRecognitionRunRef.current = true;
        startMicStream();
        setTimeout(() => {
          if (currentQ) {
            speakQuestion(currentQ.questionText);
          }
        }, 1000);
      }
    } catch (err: any) {
      toast.error("Error reloading active session: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Start Mic & Audio Context for Waveform analysis
  const startMicStream = async () => {
    try {
      if (typeof window === "undefined") return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
        micAnimationRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      initSpeechRecognition();
    } catch (err) {
      console.error("Microphone access failed:", err);
      toast.error("Failed to access microphone. Please grant browser permissions.");
    }
  };

  // Stop Mic Stream
  const stopMicStream = () => {
    shouldRecognitionRunRef.current = false;
    if (micAnimationRef.current) {
      cancelAnimationFrame(micAnimationRef.current);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    stopDeepgramRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
  };

  // Start Deepgram WebSocket Recognition
  const startDeepgramRecognition = async (): Promise<boolean> => {
    try {
      const tokenRes = await fetch("/api/deepgram/token");
      if (tokenRes.ok) {
        const { token } = await tokenRes.json();
        const ws = new WebSocket("wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", ["token", token]);
        deepgramSocketRef.current = ws;

        ws.onopen = async () => {
          try {
            const stream = micStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            deepgramRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(e.data);
              }
            };
            recorder.start(250);
          } catch (err) {
            console.error("Deepgram MediaRecorder start error:", err);
          }
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (!transcript) return;

          if (data.is_final) {
            finalizedTranscriptRef.current = (finalizedTranscriptRef.current + " " + transcript).trim();
            setTranscriptText(finalizedTranscriptRef.current);
            checkVoiceCommands(finalizedTranscriptRef.current);
          } else {
            setTranscriptText((finalizedTranscriptRef.current + " " + transcript).trim());
          }
        };

        ws.onerror = (err) => {
          console.error("Deepgram WebSocket error:", err);
        };

        ws.onclose = () => {
          console.log("Deepgram WebSocket closed");
          if (shouldRecognitionRunRef.current && view === "in_progress" && !isPaused && !isMuted) {
            setTimeout(startDeepgramRecognition, 1000);
          }
        };
        return true;
      }
    } catch (err) {
      console.warn("Deepgram token fetch failed, falling back to Web Speech:", err);
    }
    return false;
  };

  const stopDeepgramRecognition = () => {
    if (deepgramSocketRef.current) {
      try {
        deepgramSocketRef.current.onclose = null;
        deepgramSocketRef.current.close();
      } catch (e) { }
      deepgramSocketRef.current = null;
    }
    if (deepgramRecorderRef.current) {
      try {
        deepgramRecorderRef.current.stop();
      } catch (e) { }
      deepgramRecorderRef.current = null;
    }
  };

  // Initialize Speech-to-Text
  const initSpeechRecognition = async () => {
    if (typeof window === "undefined") return;

    // First try Deepgram
    const success = await startDeepgramRecognition();
    if (success) return;

    // Fallback to browser API
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.warning("Speech recognition is not fully supported in this browser. Try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalSpeech = "";
      let interimSpeech = "";

      for (let i = 0; i < event.results.length; ++i) {
        const trans = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalSpeech += trans;
        } else {
          interimSpeech += trans;
        }
      }

      // Live text is final text + interim text
      const fullText = (finalSpeech + " " + interimSpeech).trim();
      setTranscriptText(fullText);

      // Perform command detection on the final speech chunk
      if (finalSpeech) {
        checkVoiceCommands(finalSpeech);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we still want it running
      if (shouldRecognitionRunRef.current && view === "in_progress" && !isPaused && !isMuted) {
        try {
          recognition.start();
        } catch (e) {
          console.warn("Speech recognition auto-restart failed:", e);
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech recognition error:", e.error);
      if (e.error === "not-allowed") {
        toast.error("Microphone permission was denied.");
      }
    };

    recognitionRef.current = recognition;
    if (shouldRecognitionRunRef.current && !isMuted && !isPaused && !isAiSpeaking && !isThinking) {
      try {
        recognition.start();
      } catch (e) { }
    }
  };

  const startRecognitionSafely = () => {
    // Try Deepgram
    startDeepgramRecognition().then(success => {
      if (success) return;

      // Fallback
      if (!recognitionRef.current) return;
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        if (e.name === "InvalidStateError" || e.message?.includes("already started")) {
          return;
        }
        setTimeout(() => {
          try {
            if (shouldRecognitionRunRef.current && !isMuted && !isPaused && !isAiSpeaking && !isThinking) {
              recognitionRef.current.start();
            }
          } catch (err) { }
        }, 300);
      }
    });
  };

  const restartSpeechSession = () => {
    finalizedTranscriptRef.current = "";
    setTranscriptText("");
    stopDeepgramRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }
  };

  // Check for smart voice commands
  const checkVoiceCommands = (text: string) => {
    const lower = text.toLowerCase().trim();

    let commandText = "";
    let matched = false;

    if (lower.endsWith("repeat question") || lower.endsWith("repeat the question")) {
      commandText = "Repeating question";
      matched = true;
      restartSpeechSession();
      if (currentQuestion) {
        speakQuestion(currentQuestion.questionText);
      }
    } else if (lower.endsWith("give hint") || lower.endsWith("give me a hint") || lower.endsWith("need a hint")) {
      commandText = "Hint requested";
      matched = true;
      restartSpeechSession();
      handleGiveHint();
    } else if (lower.endsWith("skip question") || lower.endsWith("skip this question")) {
      commandText = "Skipping question";
      matched = true;
      restartSpeechSession();
      handleSkipQuestion();
    } else if (lower.endsWith("pause interview")) {
      commandText = "Pausing interview";
      matched = true;
      restartSpeechSession();
      handlePauseToggle(true);
    } else if (lower.endsWith("resume interview")) {
      commandText = "Resuming interview";
      matched = true;
      restartSpeechSession();
      handlePauseToggle(false);
    } else if (lower.endsWith("end interview") || lower.endsWith("finish interview")) {
      commandText = "Submitting interview";
      matched = true;
      restartSpeechSession();
      handleEndInterviewEarly();
    }

    if (matched) {
      toast.success(`Voice command detected: ${commandText}`);
    }
  };

  // SpeechSynthesis TTS function
  const speakQuestion = async (text: string) => {
    if (isMuted) return;

    shouldRecognitionRunRef.current = false;
    stopDeepgramRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    setIsAiSpeaking(true);

    try {
      let voiceModel = "aura-asteria-en"; // Default (American Female)
      if (settings.accent === "British") {
        voiceModel = settings.voice === "Male" ? "aura-helios-en" : "aura-athena-en";
      } else { // American and fallback for Indian
        voiceModel = settings.voice === "Male" ? "aura-orion-en" : "aura-asteria-en";
      }

      const res = await fetch("/api/deepgram/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceModel })
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;

        audio.onended = () => {
          setIsAiSpeaking(false);
          if (view === "in_progress" && !isPaused && !isMuted) {
            shouldRecognitionRunRef.current = true;
            startRecognitionSafely();
          }
        };

        audio.onerror = () => {
          setIsAiSpeaking(false);
          if (view === "in_progress" && !isPaused && !isMuted) {
            shouldRecognitionRunRef.current = true;
            startRecognitionSafely();
          }
        };

        await audio.play();
        return;
      }
    } catch (err) {
      console.warn("Deepgram TTS failed, falling back to Web Speech:", err);
    }

    // Fallback to browser SpeechSynthesis API
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsAiSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Voice & Accent selection mapping
    const voices = window.speechSynthesis.getVoices();
    let langCode = "en-US";
    if (settings.accent === "Indian") langCode = "en-IN";
    else if (settings.accent === "British") langCode = "en-GB";

    let voiceOptions = voices.filter((v) => v.lang.startsWith(langCode));
    if (voiceOptions.length === 0) {
      voiceOptions = voices.filter((v) => v.lang.startsWith("en"));
    }

    let selectedVoice = voiceOptions[0];
    if (settings.voice === "Female") {
      selectedVoice =
        voiceOptions.find(
          (v) =>
            v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("google") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("zira") ||
            v.name.toLowerCase().includes("hazel") ||
            v.name.toLowerCase().includes("veena") ||
            v.name.toLowerCase().includes("heera")
        ) || selectedVoice;
    } else {
      selectedVoice =
        voiceOptions.find(
          (v) =>
            v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("david") ||
            v.name.toLowerCase().includes("ravi") ||
            v.name.toLowerCase().includes("daniel")
        ) || selectedVoice;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      setIsAiSpeaking(false);
      if (view === "in_progress" && !isPaused && !isMuted) {
        shouldRecognitionRunRef.current = true;
        startRecognitionSafely();
      }
    };

    utterance.onerror = () => {
      setIsAiSpeaking(false);
      if (view === "in_progress" && !isPaused && !isMuted) {
        shouldRecognitionRunRef.current = true;
        startRecognitionSafely();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Pre-generate all questions, then countdown, then start live interview
  const startAudioSession = async () => {
    if (!context || !user) return;

    try {
      setIsGenerating(true);
      setView("generating");

      const res = await fetch("/api/audio-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          userId: user.$id,
          settings
        }),
      });

      if (!res.ok) throw new Error("Failed to initialize session");
      const data = await res.json();

      setSessionId(data.sessionId);
      setSession(data.session);
      setCurrentQuestion(data.session.questions[0]);
      localStorage.setItem("active_audio_session_id", data.sessionId);
      setIsGenerating(false);

      // Short get-ready countdown — questions are already loaded
      setView("countdown");
      let count = 5;
      setCountdown(count);
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          count--;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(timer);
            resolve();
          }
        }, 1000);
      });

      setView("in_progress");
      shouldRecognitionRunRef.current = true;
      startMicStream();
      setTimeout(() => {
        if (data.session.questions[0]) {
          speakQuestion(data.session.questions[0].questionText);
        }
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to start interview.");
      setView("permissions");
      setIsGenerating(false);
    }
  };

  // Submit current verbal answer and move forward
  const handleSubmitAnswer = async (endEarly = false) => {
    if (!sessionId || !currentQuestion) return;

    try {
      setIsSubmitting(true);
      setIsThinking(true);
      shouldRecognitionRunRef.current = false;
      stopDeepgramRecognition();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { }
      }
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }

      const res = await fetch("/api/audio-interview/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          answerText: transcriptText || "(Answered verbally - skipped text transcription)",
          violations: [],
          endInterview: endEarly
        }),
      });

      if (!res.ok) throw new Error("Failed to submit response.");
      const data = await res.json();
      const updatedSession = data.session as AudioInterviewSession;

      setSession(updatedSession);
      finalizedTranscriptRef.current = "";
      setTranscriptText("");

      if (updatedSession.status === "completed") {
        setView("completed");
        localStorage.removeItem("active_audio_session_id");
        stopMicStream();

        // If full interview, link and finalize
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const fId = params.get("fullSessionId");
          if (fId) {
            toast.info("Saving results and finalizing Full End-to-End Interview...");
            try {
              await fetch("/api/interview/link-round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fullSessionId: fId,
                  roundType: "audio",
                  roundSessionId: sessionId
                })
              });
              await fetch("/api/interview/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fullSessionId: fId
                })
              });
            } catch (e) { }
            localStorage.removeItem("interview_context_audio");
            setTimeout(() => {
              window.location.href = `/dashboard/interview?sessionId=${fId}`;
            }, 1500);
            return;
          }
        }
      } else {
        const nextQ = updatedSession.questions[updatedSession.currentQuestionIndex];
        setCurrentQuestion(nextQ);
        setIsThinking(false);
        setTimeout(() => {
          if (nextQ) {
            speakQuestion(nextQ.questionText);
          }
        }, 600);
      }
    } catch (err: any) {
      toast.error("Failed to proceed: " + err.message);
      setIsThinking(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  handleSubmitAnswerRef.current = handleSubmitAnswer;

  // Skip Current Question
  const handleSkipQuestion = () => {
    setTranscriptText("(Skipped)");
    setTimeout(() => {
      handleSubmitAnswer(false);
    }, 500);
  };

  // Provide a Hint
  const handleGiveHint = () => {
    if (!currentQuestion) return;
    const hint = `Here's a hint: Think about the core principles or trade-offs involved in this topic. Consider how standard designs apply.`;
    speakQuestion(hint);
    toast.info("AI Interviewer: Reading hint...");
  };

  // End Interview early
  const handleEndInterviewEarly = () => {
    toast.info("Concluding interview and generating report...");
    handleSubmitAnswer(true);
  };

  // Toggle voice mute
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      shouldRecognitionRunRef.current = false;
      stopDeepgramRecognition();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { }
      }
      toast.info("Microphone and synthesis muted.");
    } else {
      toast.info("Microphone and synthesis unmuted.");
      if (view === "in_progress" && !isAiSpeaking && !isThinking && !isPaused) {
        shouldRecognitionRunRef.current = true;
        startRecognitionSafely();
      }
    }
  };

  // Toggle Pause/Resume
  const handlePauseToggle = (shouldPause?: boolean) => {
    const target = shouldPause !== undefined ? shouldPause : !isPaused;
    setIsPaused(target);
    if (target) {
      shouldRecognitionRunRef.current = false;
      stopDeepgramRecognition();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { }
      }
      toast.info("Interview paused.");
    } else {
      toast.info("Interview resumed.");
      if (currentQuestion && !isAiSpeaking && !isThinking && !isMuted) {
        speakQuestion(currentQuestion.questionText);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicStream();
    };
  }, []);

  const handleExit = () => {
    const activeViews = ["permissions", "countdown", "in_progress"];
    if (activeViews.includes(view)) {
      const confirmExit = window.confirm(
        "Are you sure you want to exit the interview? Your current session progress will be cleared and reset."
      );
      if (!confirmExit) return;
    }
    stopMicStream();
    localStorage.removeItem("active_audio_session_id");
    localStorage.removeItem("interview_context_audio");
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

  // Configure new audio interview
  const handleResetAll = () => {
    stopMicStream();
    localStorage.removeItem("active_audio_session_id");
    localStorage.removeItem("interview_context_audio");
    setSessionId(null);
    setSession(null);
    setContext(null);
    setCurrentQuestion(null);
    finalizedTranscriptRef.current = "";
    setTranscriptText("");
    setView("config");

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fId = params.get("fullSessionId");
      if (fId) {
        window.location.href = `/dashboard/interview?sessionId=${fId}`;
        return;
      }
    }
  };

  // Start Targeted practice round
  const handleStartPracticeRound = async (topic: string) => {
    if (!user) return;
    try {
      setIsGenerating(true);

      const miniContext: InterviewContext = {
        source: "role",
        role: `${topic} Expert Practice`,
        jd: {
          experience: "Mid level",
          requiredSkills: [topic],
          preferredSkills: []
        }
      };

      localStorage.setItem("interview_context_audio", JSON.stringify(miniContext));
      setContext(miniContext);

      const miniSettings: AudioInterviewSettings = {
        ...settings,
        duration: 5,
        difficulty: "Adaptive",
        practiceMode: "Rapid Fire"
      };
      setSettings(miniSettings);

      setView("generating");

      const res = await fetch("/api/audio-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: miniContext,
          userId: user.$id,
          settings: miniSettings
        }),
      });

      if (!res.ok) throw new Error("Failed to initialize practice session");
      const data = await res.json();

      setSessionId(data.sessionId);
      setSession(data.session);
      setCurrentQuestion(data.session.questions[0]);
      localStorage.setItem("active_audio_session_id", data.sessionId);
      setIsGenerating(false);

      setView("countdown");
      let count = 5;
      setCountdown(count);
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          count--;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(timer);
            resolve();
          }
        }, 1000);
      });

      setView("in_progress");
      shouldRecognitionRunRef.current = true;
      startMicStream();
      setTimeout(() => {
        if (data.session.questions[0]) {
          speakQuestion(data.session.questions[0].questionText);
        }
      }, 1000);
    } catch (err: any) {
      toast.error("Failed to start practice round: " + err.message);
      setView("results");
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-[#6B7280] mt-3">Loading authentications...</p>
      </div>
    );
  }

  // Define Interview type icons mapping
  const getInterviewTypeIcon = (type: string) => {
    switch (type) {
      case "Technical":
        return <Briefcase className="w-6 h-6 text-blue-600" />;
      case "Behavioral":
        return <UserCheck className="w-6 h-6 text-blue-600" />;
      case "HR":
        return <Users className="w-6 h-6 text-blue-600" />;
      case "Mixed":
        return <Layers className="w-6 h-6 text-blue-600" />;
      case "Project Discussion":
        return <MessageSquare className="w-6 h-6 text-blue-600" />;
      case "System Design":
        return <Network className="w-6 h-6 text-blue-600" />;
      default:
        return <Briefcase className="w-6 h-6 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFC] max-w-8xl mx-auto">

      {/* HEADER BAR (only config & setup) */}
      {(view === "config" || view === "setup") && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">Audio Practice Round</h1>
            <p className="text-[#6B7280] mt-1 text-[13px]">
              Speak naturally and complete an adaptive voice mock interview. Powered by GPT OSS.
            </p>
          </div>

        </div>
      )}

      {/* VIEW: CONFIGURATION STEPPER */}
      {view === "config" && (
        <InterviewConfiguration
          interviewType="audio"
          onConfigurationComplete={() => {
            const savedContext = localStorage.getItem("interview_context_audio");
            if (savedContext) {
              setContext(JSON.parse(savedContext));
              setView("setup");
            }
          }}
        />
      )}

      {/* VIEW: SETUP & CONTEXT REVIEW */}
      {view === "setup" && context && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 max-w-2xl mx-auto shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111111]">Confirm Interview Context</h2>
              <p className="text-xs text-[#6B7280]">Review extracted details from your resume or job description.</p>
            </div>
          </div>

          <div className="space-y-5 border border-[#F3F4F6] bg-[#FAFAFA] rounded-xl p-5 mb-8 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-[#9CA3AF] block uppercase tracking-wider">Source</span>
                <span className="text-[#111111] font-medium mt-0.5 block">
                  {context.source === "resume" ? "Resume Upload" : context.source === "jd" ? "Job Description" : "Custom Role"}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#9CA3AF] block uppercase tracking-wider">Target Position</span>
                <span className="text-[#111111] font-medium mt-0.5 block">{context.role || "Software Developer"}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-[#9CA3AF] block uppercase tracking-wider mb-1.5">Core Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {(context.resume?.skills || context.jd?.requiredSkills || ["JavaScript", "React", "System Design"]).map((sk, idx) => (
                  <span key={idx} className="bg-white border border-[#E5E7EB] text-[#374151] px-2.5 py-1 rounded text-xs font-light">
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => setView("config")}
              className="text-sm font-medium text-[#6B7280] hover:text-[#111111] transition"
            >
              Go Back
            </button>
            <button
              onClick={() => setView("settings")}
              className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl transition text-sm shadow-sm"
            >
              Continue to Settings
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW: AUDIO ROUND SETTINGS */}
      {view === "settings" && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 max-w-3xl mx-auto shadow-sm">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-[#111111]">Interview Settings</h2>
              <p className="text-sm text-[#6B7280] mt-1">Configure your interview experience.</p>
            </div>
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 rounded-xl transition shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" /> Exit
            </button>
          </div>

          <div className="space-y-6 text-sm mb-8">
            {/* Duration Buttons */}
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-2 uppercase tracking-wide">Duration</label>
              <div className="flex flex-wrap gap-2.5">
                {[5, 10, 20, 30].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSettings({ ...settings, duration: t })}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-xs font-medium transition-all duration-150",
                      settings.duration === t
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#FAFAFA]"
                    )}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Buttons */}
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-2 uppercase tracking-wide">Difficulty</label>
              <div className="flex flex-wrap gap-2.5">
                {["Easy", "Medium", "Hard", "Adaptive"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setSettings({ ...settings, difficulty: d as any })}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-xs font-medium transition-all duration-150",
                      settings.difficulty === d
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#FAFAFA]"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Interview Type Cards Grid */}
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-3.5 uppercase tracking-wide">Interview Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
                {["Technical", "Behavioral", "HR", "Mixed", "Project Discussion", "System Design"].map((type) => {
                  const isSelected = settings.interviewType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSettings({ ...settings, interviewType: type as any })}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl border bg-white transition-all duration-200 text-center gap-2.5 min-h-[96px]",
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10 shadow-sm"
                          : "border-[#E5E7EB] hover:border-slate-300"
                      )}
                    >
                      {getInterviewTypeIcon(type)}
                      <span className={cn("text-[11px] font-medium block truncate w-full", isSelected ? "text-blue-600 font-semibold" : "text-[#475569]")}>
                        {type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Voice Buttons */}
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-2 uppercase tracking-wide">AI Voice</label>
              <div className="flex flex-wrap gap-2.5">
                {["Male", "Female"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setSettings({ ...settings, voice: v as any })}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-xs font-medium transition-all duration-150",
                      settings.voice === v
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#FAFAFA]"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Buttons */}
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-2 uppercase tracking-wide">Accent</label>
              <div className="flex flex-wrap gap-2.5">
                {["American", "Indian", "British"].map((a) => (
                  <button
                    key={a}
                    onClick={() => setSettings({ ...settings, accent: a as any })}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-xs font-medium transition-all duration-150",
                      settings.accent === a
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#FAFAFA]"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Practice Mode Buttons */}
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-2 uppercase tracking-wide">Practice Mode</label>
              <div className="flex flex-wrap gap-2.5">
                {[
                  { value: "Rapid Fire", label: "Rapid Fire" },
                  { value: "Deep Technical", label: "Deep Technical" },
                  { value: "Behavioral Practice", label: "Behavioral" },
                  { value: "Project Discussion", label: "Project Discussion" },
                  { value: "HR Round", label: "HR Round" },
                  { value: "System Design", label: "System Design" },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setSettings({ ...settings, practiceMode: mode.value as any })}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-xs font-medium transition-all duration-150",
                      settings.practiceMode === mode.value
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#FAFAFA]"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-[#F3F4F6]">
            <button
              onClick={() => setView("setup")}
              className="text-sm font-medium text-[#6B7280] hover:text-[#111111] transition"
            >
              Go Back
            </button>
            <button
              onClick={() => setView("permissions")}
              className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition text-sm shadow-sm"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW: MICROPHONE PERMISSION SCREEN */}
      {view === "permissions" && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 max-w-2xl mx-auto shadow-sm relative overflow-hidden">
          {/* Notifications area / initials profile mock in upper right */}
          <div className="absolute top-5 right-6 flex items-center gap-3">
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-lg transition font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> Exit
            </button>
            <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-semibold text-[11px] flex items-center justify-center">
              MY
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#111111]">Microphone Permission</h2>
            <p className="text-sm text-[#6B7280] mt-1">We only need access to your microphone.</p>
          </div>

          {/* Central circular waveform visualization */}
          <div className="flex flex-col items-center justify-center my-10 gap-6">
            <div className="flex items-center justify-center gap-8 w-full max-w-sm">
              {/* Left wave bars */}
              <div className="flex items-end gap-1 h-12 w-24 justify-end">
                {[12, 24, 16, 32, 20, 28, 14].map((h, i) => (
                  <div key={i} style={{ height: `${h}px` }} className="w-1 bg-blue-400/70 rounded-full" />
                ))}
              </div>

              {/* Pulsing Mic Circle */}
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full scale-125 animate-ping" />
                <div className="absolute inset-0 bg-blue-500/20 rounded-full scale-110" />
                <button
                  onClick={startMicStream}
                  className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center relative z-10 shadow-lg hover:bg-blue-700 transition"
                >
                  <Mic className="w-6 h-6" />
                </button>
              </div>

              {/* Right wave bars */}
              <div className="flex items-end gap-1 h-12 w-24">
                {[14, 28, 20, 32, 16, 24, 12].map((h, i) => (
                  <div key={i} style={{ height: `${h}px` }} className="w-1 bg-blue-400/70 rounded-full" />
                ))}
              </div>
            </div>

            {/* Connection Status Box */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-3 shadow-sm inline-flex flex-col items-center min-w-[200px]">
              <span className="text-xs font-semibold text-slate-800">Microphone</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={cn("w-2 h-2 rounded-full", micStreamRef.current ? "bg-emerald-500 animate-pulse" : "bg-red-400")} />
                <span className={cn("text-[11px] font-bold", micStreamRef.current ? "text-emerald-600" : "text-red-500")}>
                  Status: {micStreamRef.current ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy Box */}
          <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4 text-center max-w-md mx-auto mb-10">
            <p className="text-[12px] text-blue-600 leading-relaxed">
              We do not require camera or screen access. <br />
              <span className="font-semibold">Your privacy is important to us.</span>
            </p>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-[#F3F4F6]">
            <button
              onClick={() => setView("settings")}
              className="text-sm font-medium text-[#6B7280] hover:text-[#111111]"
            >
              Back to Settings
            </button>
            <button
              onClick={startAudioSession}
              disabled={isGenerating}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-sm transition"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating questions…
                </>
              ) : (
                "Start Interview"
              )}
            </button>
          </div>
        </div>
      )}

      {/* VIEW: AI GENERATING QUESTIONS */}
      {view === "generating" && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 max-w-2xl mx-auto shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
            <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-[#111111]">AI is generating your questions</h2>
          <p className="text-sm text-[#6B7280] mt-2 max-w-md leading-relaxed">
            Personalizing a full question set from your resume, job description, and role.
            The live interview will start only after this finishes — no pauses mid-call.
          </p>
          <div className="mt-8 w-full max-w-sm bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 text-left space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Building candidate blueprint…
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:150ms]" />
              Writing {settings.duration === 5 ? 5 : settings.duration === 10 ? 10 : settings.duration === 20 ? 15 : 20} voice interview questions…
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:300ms]" />
              Preparing your interview room…
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-6">This usually takes a few seconds</p>
        </div>
      )}

      {/* VIEW: COUNTDOWN TIMER */}
      {view === "countdown" && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 max-w-2xl mx-auto shadow-sm flex flex-col items-center">
          <div className="mb-6 text-center w-full relative">
            <h2 className="text-2xl font-bold text-[#111111]">Get Ready!</h2>
            <p className="text-sm text-[#6B7280] mt-1">
              All questions are ready. Your interview is about to start.
            </p>
            <button
              onClick={handleExit}
              className="absolute top-0 right-0 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> Exit
            </button>
          </div>

          {/* Large Countdown timer circle */}
          <div className="relative w-32 h-32 flex items-center justify-center my-8">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="#E5E7EB" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#2563EB"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - countdown / 5)}
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute text-4xl font-extrabold text-blue-600">{countdown}</span>
          </div>

          {/* Tips panel */}
          <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl p-6 w-full max-w-md text-left mt-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Tips for a great interview</h3>
            <ul className="space-y-3.5 text-xs text-[#475569]">
              <li className="flex gap-2.5 items-start">
                <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Speak clearly and at a normal pace</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Answer as naturally as you would in real interview</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>You can ask AI to repeat the question</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Use commands like &quot;give hint&quot;, &quot;skip&quot;, &quot;I don&apos;t know&quot;</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* VIEW: IN_PROGRESS AUDIO ROOM */}
      {view === "in_progress" && (
        <div className="bg-white text-slate-800 rounded-2xl flex flex-col min-h-[600px] border border-slate-200/80 shadow-sm overflow-hidden animate-in fade-in duration-200 w-full">

          {/* Header Bar */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10">
            <div className="flex items-center gap-2.5">
              {/* Star/Wave Interview Logo */}
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <Activity className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-bold text-slate-800">Audio Interview in Progress</span>
            </div>

            {/* Timer & Question Details */}
            <div className="flex items-center gap-5">
              <span className="text-[12px] font-semibold text-slate-500">
                Question {(session?.currentQuestionIndex ?? 0) + 1}/{session?.questions.length || (settings.duration === 5 ? 5 : settings.duration === 10 ? 10 : settings.duration === 20 ? 15 : 20)}
              </span>

              <button
                onClick={handleExit}
                className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-lg border border-rose-200 transition font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" /> Exit Interview
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-[12px] font-bold font-mono text-red-650 text-red-600">{formatTimer(timerSeconds)}</span>
              </div>
            </div>
          </header>

          {/* Tabs Navigation for Rooms */}
          <div className="flex justify-center border-b border-slate-100 bg-slate-50/50 py-2.5 gap-2 z-10">
            {[
              { id: "interviewer", label: "Interviewer View" },
              { id: "transcript", label: "Live Transcript" },
              { id: "commands", label: "Smart Commands" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-all",
                  activeTab === t.id
                    ? "bg-white text-slate-800 border border-slate-200 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center relative bg-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.015),transparent_50%)] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">

              {/* TAB 1: INTERVIEWER VIEW (Standard Siri Waveform view) */}
              {activeTab === "interviewer" && (
                <div className="flex flex-col items-center">

                  {/* Speaking/Listening Waveform */}
                  <div className="my-8 w-full flex flex-col items-center">
                    {isAiSpeaking ? (
                      <div className="flex flex-col items-center gap-4">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-3.5 py-1 rounded-full tracking-wider uppercase shadow-sm">AI Speaking...</span>
                        <Waveform state="ai" volume={0} barCount={26} height={60} color="blue" />
                      </div>
                    ) : isThinking ? (
                      <div className="flex flex-col items-center gap-4">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-3.5 py-1 rounded-full tracking-wider uppercase shadow-sm">Saving...</span>
                        <div className="flex items-center gap-2 py-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" />
                        </div>
                        <p className="text-xs text-slate-500 italic">Saving your answer and moving on…</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <span className="text-[10px] font-bold text-emerald-650 text-emerald-605 text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-3.5 py-1 rounded-full tracking-wider uppercase shadow-sm">Listening...</span>
                        <Waveform state="listening" volume={micVolume} barCount={26} height={60} color="green" />
                        <span className="text-xs text-slate-400 italic">Speak now...</span>
                      </div>
                    )}
                  </div>

                  {/* Question Display Card */}
                  <div className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl p-6 text-center mt-6 shadow-sm">
                    {isThinking ? (
                      <p className="text-slate-400 text-sm italic font-light">Loading the next question…</p>
                    ) : (
                      <p className="text-slate-800 text-sm leading-relaxed font-normal">
                        {currentQuestion ? currentQuestion.questionText : "Initializing interviewer..."}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: LIVE TRANSCRIPT VIEW */}
              {activeTab === "transcript" && (
                <div className="flex flex-col h-[400px] w-full bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Live Transcript</h3>
                  <p className="text-[11px] text-slate-400 mb-4 border-b border-slate-100 pb-2">Real-time speech translation timeline</p>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                    {session?.questions.map((q, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* AI bubble */}
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border border-blue-100">
                            AI
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 leading-relaxed text-slate-700 border border-slate-100 max-w-[80%]">
                            {q.questionText}
                          </div>
                        </div>

                        {/* Candidate bubble */}
                        {q.answerText && (
                          <div className="flex items-start gap-2.5 justify-end">
                            <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 leading-relaxed border border-emerald-100 max-w-[80%]">
                              {q.answerText}
                            </div>
                            <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border border-emerald-100">
                              You
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Current transcript interim text */}
                    {transcriptText && (
                      <div className="flex items-start gap-2.5 justify-end">
                        <div className="bg-blue-50 text-blue-700 rounded-xl p-3 leading-relaxed border border-blue-100 max-w-[80%] animate-pulse">
                          {transcriptText}
                        </div>
                        <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold border border-blue-100 animate-pulse">
                          ...
                        </div>
                      </div>
                    )}

                    {!session?.questions.length && !transcriptText && (
                      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                        <Info className="w-5 h-5 mb-1.5" />
                        <p className="text-[11px]">No spoken dialog logged yet.</p>
                      </div>
                    )}
                  </div>

                  {/* Ambient wave at bottom of transcript */}
                  <div className="border-t border-slate-100 pt-3 mt-2 flex items-center justify-center">
                    <Waveform state={isAiSpeaking ? "ai" : isThinking ? "thinking" : "listening"} volume={micVolume} barCount={32} height={24} color="blue" />
                  </div>
                </div>
              )}

              {/* TAB 3: SMART COMMANDS */}
              {activeTab === "commands" && (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm w-full">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Smart Commands</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">You can use these voice commands anytime during the interview.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {[
                      { title: "Repeat", desc: "Repeat the last question.", icon: <RefreshCw className="w-4 h-4 text-blue-500" /> },
                      { title: "Give Hint", desc: "Give me a hint for this question.", icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
                      { title: "Skip Question", desc: "Skip this question and move next.", icon: <ChevronRight className="w-4 h-4 text-red-500" /> },
                      { title: "Can You Explain", desc: "Explain the concept in detail.", icon: <Info className="w-4 h-4 text-emerald-500" /> },
                      { title: "I Don't Know", desc: "I don't know the answer.", icon: <HelpCircle className="w-4 h-4 text-purple-500" /> },
                      { title: "Pause Interview", desc: "Pause the interview temporarily.", icon: <Pause className="w-4 h-4 text-indigo-500" /> },
                    ].map((cmd, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col gap-1.5 animate-in fade-in duration-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-white rounded-md border border-slate-200 shadow-sm">
                            {cmd.icon}
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{cmd.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal">{cmd.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Warning banner */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 mt-5 flex items-start gap-2.5 animate-in fade-in duration-200">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 leading-relaxed font-normal">
                      Just say the command naturally. <br />
                      <span className="font-semibold">Example: &quot;Repeat question&quot; or &quot;Give me a hint&quot;</span>
                    </p>
                  </div>
                </div>
              )}

            </div>
          </main>

          {/* Control Bar (Footer) */}
          <footer className="flex items-center justify-between px-6 py-5 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm z-10">
            {/* Control buttons */}
            <div className="flex items-center gap-3">
              {/* Mute button */}
              <button
                onClick={handleMuteToggle}
                className={cn(
                  "flex flex-col items-center justify-center w-14 h-14 rounded-xl border transition text-center gap-0.5 shadow-sm",
                  isMuted
                    ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800"
                )}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="text-[9px] font-semibold mt-0.5">Mute</span>
              </button>

              {/* Pause button */}
              <button
                onClick={() => handlePauseToggle()}
                className={cn(
                  "flex flex-col items-center justify-center w-14 h-14 rounded-xl border transition text-center gap-0.5 shadow-sm",
                  isPaused
                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800"
                )}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span className="text-[9px] font-semibold mt-0.5">Pause</span>
              </button>

              {/* Repeat button */}
              <button
                onClick={() => {
                  if (currentQuestion) speakQuestion(currentQuestion.questionText);
                }}
                disabled={isSubmitting || isThinking || isAiSpeaking}
                className="flex flex-col items-center justify-center w-14 h-14 rounded-xl border bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 disabled:opacity-30 transition gap-0.5 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-[9px] font-semibold mt-0.5">Repeat</span>
              </button>

              {/* Hint button */}
              <button
                onClick={handleGiveHint}
                disabled={isSubmitting || isThinking || isAiSpeaking}
                className="flex flex-col items-center justify-center w-14 h-14 rounded-xl border bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 disabled:opacity-30 transition gap-0.5 shadow-sm"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="text-[9px] font-semibold mt-0.5">Hint</span>
              </button>

              {/* Skip button */}
              <button
                onClick={handleSkipQuestion}
                disabled={isSubmitting || isThinking || isAiSpeaking}
                className="flex flex-col items-center justify-center w-14 h-14 rounded-xl border bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 disabled:opacity-30 transition gap-0.5 shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
                <span className="text-[9px] font-semibold mt-0.5">Skip</span>
              </button>
            </div>

            {/* End Interview button */}
            <button
              onClick={handleEndInterviewEarly}
              className="bg-red-650 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3.5 rounded-xl text-xs transition duration-150 shadow-sm"
            >
              End Interview
            </button>
          </footer>
        </div>
      )}

      {/* VIEW: COMPLETED LOADING SCREEN */}
      {view === "completed" && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 max-w-2xl mx-auto shadow-sm flex flex-col items-center justify-center animate-in fade-in duration-200 w-full">
          {/* Confetti decoration circles */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            {/* Green background circle */}
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center z-10 relative">
              <Check className="w-8 h-8 text-white stroke-[3.5]" />
            </div>

            {/* Confetti dot clusters */}
            <div className="absolute top-0 left-4 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <div className="absolute bottom-2 right-4 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <div className="absolute top-8 right-0 w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
            <div className="absolute bottom-6 left-0 w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
          </div>

          <h2 className="text-2xl font-bold text-[#111111] text-center mb-1">Great job! Your interview has been completed.</h2>
          <p className="text-xs text-[#6B7280] text-center mb-8 uppercase tracking-widest font-semibold">Evaluation summary</p>

          {/* Stats cards container */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-8">
            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Questions</span>
              <span className="text-2xl font-extrabold text-slate-800 mt-1 block">{session ? session.questions.length : 10}</span>
            </div>

            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
              <span className="text-2xl font-extrabold text-slate-800 mt-1 block">{formatTimer(timerSeconds)}</span>
            </div>

            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Score</span>
              <span className="text-2xl font-extrabold text-blue-600 mt-1 block">
                {session?.evaluation?.overallScore ?? 0}%
              </span>
              <span className={`text-[10px] font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${
                session?.evaluation?.passed
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-rose-700 bg-rose-50"
              }`}>
                {session?.evaluation?.passed ? "Passed" : "Needs Practice"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3.5 w-full max-w-xs">
            <button
              onClick={() => {
                if (session?.report) setView("results");
                else loadSession(sessionId || "");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition text-xs shadow-md"
            >
              View Detailed Report
            </button>

            <button
              onClick={handleResetAll}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fullSessionId") ? "Return to Full Interview" : "Start Another Interview"}
            </button>

            <button
              onClick={handleExit}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              Exit to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* VIEW: DETAILED REPORTS & METRICS */}
      {view === "results" && session?.report && (
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
          <InterviewReportView report={formatToUnifiedReport(session, "audio")} />
        </div>
      )}

    </div>
  );
}
