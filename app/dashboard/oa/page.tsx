"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { InterviewConfiguration } from "@/src/components/Dashboard/InterviewConfiguration";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";
import {
  Brain,
  Code2,
  Clock,
  CheckCircle,
  HelpCircle,
  Play,
  RotateCw,
  Award,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Sparkles,
  Star,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  LogOut,
  Camera,
  Monitor,
  Mic
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types matching index.ts
import type {
  InterviewSession,
  MCQQuestion,
  CodingQuestion,
  AptitudeQuestion,
  OAEvaluation,
  OAReport,
  InterviewContext
} from "@/src/types";
import { InterviewReportView } from "@/src/components/Report/InterviewReportView";
import { formatToUnifiedReport } from "@/src/lib/reportFormatter";

type ViewState =
  | "setup"
  | "overview"
  | "mcq"
  | "mcq_review"
  | "coding_list"
  | "coding_editor"
  | "aptitude"
  | "aptitude_review"
  | "results"
  | "report";

export default function OARoundPage() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<ViewState>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [contextReady, setContextReady] = useState(false);

  // Question lists (retrieved from backend)
  const [mcqQuestions, setMCQQuestions] = useState<MCQQuestion[]>([]);
  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>([]);
  const [aptitudeQuestions, setAptitudeQuestions] = useState<AptitudeQuestion[]>([]);

  // Selection states
  const [activeMCQIndex, setActiveMCQIndex] = useState(0);
  const [activeAptitudeIndex, setActiveAptitudeIndex] = useState(0);
  const [selectedCodingQuestion, setSelectedCodingQuestion] = useState<CodingQuestion | null>(null);

  // Active answer structures (client state before saving to DB)
  const [mcqAnswers, setMCQAnswers] = useState<Record<string, string>>({});
  const [mcqMarked, setMCQMarked] = useState<Record<string, boolean>>({});
  const [aptitudeAnswers, setAptitudeAnswers] = useState<Record<string, string>>({});
  const [aptitudeMarked, setAptitudeMarked] = useState<Record<string, boolean>>({});

  // Code Editor states
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [editorCode, setEditorCode] = useState("");
  const [editorTheme, setEditorTheme] = useState("vs-light");
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [codeOutputTab, setCodeOutputTab] = useState<"description" | "results" | "submissions">("description");
  const [runResults, setRunResults] = useState<any>(null);
  const [customInput, setCustomInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);

  // Timers (in seconds)
  const [mcqTimeLeft, setMCQTimeLeft] = useState(20 * 60);
  const [aptitudeTimeLeft, setAptitudeTimeLeft] = useState(15 * 60);
  const [codingTimeLeft, setCodingTimeLeft] = useState(45 * 60);

  const mcqTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aptitudeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const codingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Violation logging + E2E proctoring
  const [violations, setViolations] = useState<{ type: string; timestamp: string }[]>([]);
  const [endingTest, setEndingTest] = useState(false);
  const autoStartedRef = useRef(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [proctorReady, setProctorReady] = useState(false);
  const [warningModal, setWarningModal] = useState<{
    type: "tab" | "fullscreen" | "screenshare";
    count?: number;
  } | null>(null);
  const [screenGraceSeconds, setScreenGraceSeconds] = useState(0);
  const lastTabViolationRef = useRef(0);
  const screenGraceTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorStartedRef = useRef(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const getFullSessionId = () => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("fullSessionId");
  };
  const isProctoredE2E = () => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("fullSessionId"));
  };
  const isActiveExamView = (v: ViewState) =>
    [
      "overview",
      "mcq",
      "mcq_review",
      "coding_list",
      "coding_editor",
      "aptitude",
      "aptitude_review",
    ].includes(v);

  // Loading indicator for generation/submission
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);

  // Report toggle sections
  const [activeReportSection, setActiveReportSection] = useState<string>("overview");

  const handleExit = () => {
    const activeViews = ["mcq", "mcq_review", "coding_list", "coding_editor", "aptitude", "aptitude_review"];
    if (activeViews.includes(view)) {
      const confirmExit = window.confirm(
        "Are you sure you want to exit the assessment? Your current session progress will be cleared and reset."
      );
      if (!confirmExit) return;
    }
    localStorage.removeItem("active_oa_session_id");
    localStorage.removeItem("interview_context_oa");
    setSessionId(null);
    setSession(null);
    setContextReady(false);
    setView("setup");

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

  // Load session from storage if existing
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
              // OA already done → jump to AI round
              if (fullSess.oaSessionId && !fullSess.aiSessionId) {
                window.location.href = `/dashboard/ai?fullSessionId=${queryFullId}`;
                return;
              }
              // Both done → results hub
              if (fullSess.status === "completed" || (fullSess.oaSessionId && fullSess.aiSessionId)) {
                window.location.href = `/dashboard/interview?sessionId=${queryFullId}`;
                return;
              }
              if (fullSess.oaSessionId) {
                window.location.href = `/dashboard/oa?sessionId=${fullSess.oaSessionId}&fullSessionId=${queryFullId}`;
                return;
              }
              const ctx = {
                source: "role" as const,
                role: fullSess.blueprint.role,
                jd: {
                  experience: "Mid level",
                  requiredSkills: fullSess.blueprint.skills || [],
                  preferredSkills: []
                }
              };
              localStorage.setItem("interview_context_oa", JSON.stringify(ctx));
              setContextReady(true);
              setView("setup");
            }
          })
          .catch(err => console.error(err));
        return;
      }
    }

    // Direct access without sessionId or fullSessionId: restore active session or saved context if available
    const activeSaved = localStorage.getItem("active_oa_session_id");
    const contextSaved = localStorage.getItem("interview_context_oa");
    if (activeSaved) {
      setSessionId(activeSaved);
      loadSession(activeSaved);
    } else if (contextSaved) {
      setContextReady(true);
      setView("setup");
    } else {
      setSessionId(null);
      setSession(null);
      setContextReady(false);
      setView("setup");
    }
  }, []);

  const stopOAProctorStreams = () => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    micStreamRef.current = null;
    screenStreamRef.current = null;
    setCameraStream(null);
    setMicStream(null);
    setScreenStream(null);
    setProctorReady(false);
    proctorStartedRef.current = false;
    if (screenGraceTimeoutRef.current) {
      clearInterval(screenGraceTimeoutRef.current);
      screenGraceTimeoutRef.current = null;
    }
  };

  const endFullTestRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  const logOAViolation = (type: "tab_switch" | "fullscreen_exit" | "screen_share_interrupted") => {
    if (type === "tab_switch") {
      const now = Date.now();
      if (now - lastTabViolationRef.current < 2000) return;
      lastTabViolationRef.current = now;
    }

    const newViolation = { type, timestamp: new Date().toLocaleTimeString() };
    setViolations((prev) => {
      const next = [...prev, newViolation];
      const allPrev = session?.violations || [];
      const total =
        allPrev.filter((v) => v.type === type).length +
        next.filter((v) => v.type === type).length;

      if (type === "tab_switch") {
        if (total >= 5 && isProctoredE2E()) {
          toast.error("Assessment ended due to excessive tab-switch violations.");
          void endFullTestRef.current(true);
        } else {
          setWarningModal({ type: "tab", count: total });
          toast.warning(`Tab switch logged (${total}/5). Stay on this tab.`, {
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          });
        }
      } else if (type === "fullscreen_exit") {
        setWarningModal({ type: "fullscreen" });
      } else {
        setWarningModal({ type: "screenshare" });
      }
      return next;
    });
  };

  const handleScreenShareInterrupted = () => {
    logOAViolation("screen_share_interrupted");
    setScreenGraceSeconds(30);
    let remaining = 30;
    if (screenGraceTimeoutRef.current) clearInterval(screenGraceTimeoutRef.current);
    screenGraceTimeoutRef.current = setInterval(() => {
      remaining -= 1;
      setScreenGraceSeconds(remaining);
      if (remaining <= 0) {
        if (screenGraceTimeoutRef.current) clearInterval(screenGraceTimeoutRef.current);
        toast.error("Screen sharing was not restored. Ending test.");
        void endFullTestRef.current(true);
      }
    }, 1000);
  };

  const resumeScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      if (screenGraceTimeoutRef.current) clearInterval(screenGraceTimeoutRef.current);
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setWarningModal(null);
      toast.success("Screen sharing restored.");
      stream.getVideoTracks()[0].onended = () => handleScreenShareInterrupted();
    } catch {
      toast.error("Failed to re-share screen. Please try again.");
    }
  };

  const requestReFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setWarningModal(null);
    } catch {
      toast.error("Click anywhere and allow fullscreen to continue.");
    }
  };

  const startOAProctoring = async () => {
    if (proctorStartedRef.current) return;
    proctorStartedRef.current = true;
    try {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        console.warn("Fullscreen request deferred");
      }

      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      const cam = new MediaStream([media.getVideoTracks()[0]]);
      const mic = new MediaStream([media.getAudioTracks()[0]]);
      cameraStreamRef.current = cam;
      micStreamRef.current = mic;
      setCameraStream(cam);
      setMicStream(mic);

      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = display;
      setScreenStream(display);
      display.getVideoTracks()[0].onended = () => handleScreenShareInterrupted();

      setProctorReady(true);
      toast.success("Proctoring active: camera, mic, and screen share.");
    } catch (err) {
      stopOAProctorStreams();
      toast.error("Camera, microphone, and screen share are required for this interview.");
    }
  };

  // Bind cam preview
  useEffect(() => {
    if (proctorVideoRef.current && cameraStream) {
      proctorVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // E2E: start device proctoring once exam is active
  useEffect(() => {
    if (!isProctoredE2E() || !sessionId || !isActiveExamView(view)) return;
    void startOAProctoring();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, view]);

  // Proctoring listeners (E2E full suite; standalone OA keeps tab/copy alerts)
  useEffect(() => {
    if (!sessionId || !isActiveExamView(view)) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (isProctoredE2E()) logOAViolation("tab_switch");
        else {
          setViolations((prev) => [
            ...prev,
            { type: "tab_switch", timestamp: new Date().toLocaleTimeString() },
          ]);
          toast.warning("Warning: Tab switching is monitored and logged.", {
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          });
        }
      }
    };

    const handleBlur = () => {
      if (isProctoredE2E()) logOAViolation("tab_switch");
      else {
        setViolations((prev) => [
          ...prev,
          { type: "tab_switch", timestamp: new Date().toLocaleTimeString() },
        ]);
        toast.warning("Warning: Focus loss is monitored and logged.", {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isProctoredE2E()) {
        logOAViolation("fullscreen_exit");
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      setViolations((prev) => [
        ...prev,
        { type: "copy_attempt", timestamp: new Date().toLocaleTimeString() },
      ]);
      toast.error("Copying is disabled during the assessment.");
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, view, session]);

  useEffect(() => {
    return () => {
      stopOAProctorStreams();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer: MCQ
  useEffect(() => {
    if (view === "mcq" && mcqTimeLeft > 0) {
      mcqTimerRef.current = setInterval(() => {
        setMCQTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(mcqTimerRef.current!);
            handleMCQSubmit(true); // auto submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (mcqTimerRef.current) clearInterval(mcqTimerRef.current);
    }

    return () => {
      if (mcqTimerRef.current) clearInterval(mcqTimerRef.current);
    };
  }, [view, mcqTimeLeft]);

  // Timer: Coding
  useEffect(() => {
    if ((view === "coding_list" || view === "coding_editor") && codingTimeLeft > 0) {
      codingTimerRef.current = setInterval(() => {
        setCodingTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(codingTimerRef.current!);
            handleCodingRoundSubmit(); // auto submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (codingTimerRef.current) clearInterval(codingTimerRef.current);
    }

    return () => {
      if (codingTimerRef.current) clearInterval(codingTimerRef.current);
    };
  }, [view, codingTimeLeft]);

  // Timer: Aptitude
  useEffect(() => {
    if (view === "aptitude" && aptitudeTimeLeft > 0) {
      aptitudeTimerRef.current = setInterval(() => {
        setAptitudeTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(aptitudeTimerRef.current!);
            handleAptitudeSubmit(true); // auto submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (aptitudeTimerRef.current) clearInterval(aptitudeTimerRef.current);
    }

    return () => {
      if (aptitudeTimerRef.current) clearInterval(aptitudeTimerRef.current);
    };
  }, [view, aptitudeTimeLeft]);

  // Fetch session details
  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`/api/oa/questions?sessionId=${id}`);
      if (!res.ok) throw new Error("Session loading failed.");
      const data = await res.json();

      setMCQQuestions(data.mcqQuestions || []);
      setCodingQuestions(data.codingQuestions || []);
      setAptitudeQuestions(data.aptitudeQuestions || []);

      // Load full session from local file db
      const sessionRes = await fetch(`/api/oa/result?sessionId=${id}`);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const activeSession = sessionData.session;
        if (activeSession) {
          setSession(activeSession);
          if (activeSession.evaluation) {
            setView("results");
            return;
          }
          // Restore progress states
          setMCQAnswers(activeSession.mcqAnswers || {});
          setAptitudeAnswers(activeSession.aptitudeAnswers || {});

          // Determine where the user left off based on round status
          if (activeSession.aptitudeStatus === "completed") {
            setView("results");
          } else if (activeSession.aptitudeStatus === "in_progress") {
            setView("aptitude");
          } else if (activeSession.codingStatus === "completed") {
            setView("aptitude");
          } else if (activeSession.codingStatus === "in_progress") {
            setView("coding_list");
          } else if (activeSession.mcqStatus === "completed") {
            setView("coding_list");
          } else if (activeSession.mcqStatus === "in_progress") {
            setView("mcq");
          } else {
            setView("overview");
          }
          return;
        }
      }

      setView("overview");
    } catch (err) {
      console.error(err);
      toast.error("Failed to recover the active assessment session.");
      handleResetAll();
    }
  };

  // Start Assessment Session
  const handleStartAssessment = async () => {
    const savedContext = localStorage.getItem("interview_context_oa");
    if (!savedContext || !user) {
      toast.error("Please configure your profile context first.");
      return;
    }

    try {
      setIsGenerating(true);
      const parsedContext = JSON.parse(savedContext) as InterviewContext;

      // 1. POST /api/oa/start
      const startRes = await fetch("/api/oa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: parsedContext,
          userId: user.$id,
        }),
      });

      if (!startRes.ok) throw new Error("Failed to initialize session.");
      const startData = await startRes.json();
      const newSessionId = startData.sessionId;

      setSessionId(newSessionId);
      localStorage.setItem("active_oa_session_id", newSessionId);

      // 2. POST /api/oa/generate (Parallel AI questions generation)
      const genRes = await fetch("/api/oa/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSessionId }),
      });

      if (!genRes.ok) throw new Error("Failed to generate assessment questions.");
      const genData = await genRes.json();

      toast.success("Online Assessment generated successfully!");
      if (isProctoredE2E()) {
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } catch (e) {
          console.warn("Fullscreen rejected", e);
        }
      }
      await loadSession(newSessionId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate assessment.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-start OA when arriving from E2E proctored flow
  useEffect(() => {
    if (!contextReady || !user || authLoading || autoStartedRef.current) return;
    if (!isProctoredE2E()) return;
    if (sessionId) return;
    autoStartedRef.current = true;
    handleStartAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, user, authLoading]);

  const handleEndFullTest = async (force = false) => {
    const fId = getFullSessionId();
    if (!fId) {
      handleExit();
      return;
    }
    if (!force) {
      const ok = window.confirm(
        "End the full interview now? Your OA progress will be saved and you can view results."
      );
      if (!ok) return;
    }
    setEndingTest(true);
    try {
      // Link OA round if we have a session
      if (sessionId) {
        await fetch("/api/interview/link-round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullSessionId: fId,
            roundType: "oa",
            roundSessionId: sessionId,
          }),
        });
      }
      await fetch("/api/interview/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullSessionId: fId }),
      });
      localStorage.removeItem("active_oa_session_id");
      localStorage.removeItem("interview_context_oa");
      stopOAProctorStreams();
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch {}
      }
      toast.success("Test ended. Opening results...");
      window.location.href = `/dashboard/interview?sessionId=${fId}`;
    } catch (err) {
      toast.error("Failed to end test.");
      setEndingTest(false);
    }
  };
  endFullTestRef.current = handleEndFullTest;

  // MCQ Round Submit
  const handleMCQSubmit = async (isAuto = false) => {
    if (!sessionId) return;
    try {
      setIsSubmittingRound(true);
      const res = await fetch("/api/oa/submit/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers: mcqAnswers,
          violations,
        }),
      });

      if (!res.ok) throw new Error("Submission failed.");

      // Clear local violations cache after syncing to session
      setViolations([]);
      toast.success(isAuto ? "Time limit exceeded. MCQ section auto-submitted." : "MCQ section submitted successfully!");
      await loadSession(sessionId);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit MCQ round answers.");
    } finally {
      setIsSubmittingRound(false);
    }
  };

  // Coding problem selection
  const handleSelectProblem = (prob: CodingQuestion) => {
    setSelectedCodingQuestion(prob);
    // Load existing code if any, else load starter template
    const existing = session?.codingAnswers?.[prob.id];
    if (existing) {
      setEditorCode(existing.code);
      setCodeLanguage(existing.language);
    } else {
      setEditorCode(getLanguageTemplate(codeLanguage, prob));
    }
    setRunResults(null);
    setCodeOutputTab("description");
    setView("coding_editor");
  };

  const getLanguageTemplate = (lang: string, question: CodingQuestion) => {
    let entryFunctionName = "solution";
    if (question.title === "Two Sum") entryFunctionName = "twoSum";
    else if (question.title === "Valid Parentheses") entryFunctionName = "isValid";
    else if (question.title === "Longest Substring Without Repeating Characters") entryFunctionName = "lengthOfLongestSubstring";
    else if (question.title === "Binary Tree Level Order Traversal") entryFunctionName = "levelOrder";
    else if (question.title === "Merge k Sorted Lists") entryFunctionName = "mergeKLists";

    switch (lang.toLowerCase()) {
      case "javascript":
      case "typescript":
        return `function ${entryFunctionName}(input) {\n    // Write your code here\n    \n}`;
      case "python":
        return `def ${entryFunctionName}(input):\n    # Write your code here\n    pass`;
      case "java":
        return `class Solution {\n    public Object ${entryFunctionName}(Object input) {\n        // Write your code here\n        return null;\n    }\n}`;
      case "cpp":
        return `class Solution {\npublic:\n    auto ${entryFunctionName}(auto input) {\n        // Write your code here\n    }\n};`;
      default:
        return `// Write your code here`;
    }
  };

  // Run Code logic
  const handleRunCode = async () => {
    if (!selectedCodingQuestion || !sessionId) return;
    try {
      setIsRunningCode(true);
      setCodeOutputTab("results");
      setRunResults(null);

      // Run code locally using the judge sandbox
      const res = await fetch("/api/oa/submit/coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: selectedCodingQuestion.id,
          code: editorCode,
          language: codeLanguage,
          submitAll: false, // only run
        }),
      });

      if (!res.ok) throw new Error("Compilation/run failed.");
      const data = await res.json();
      setRunResults(data);
    } catch (err) {
      console.error(err);
      toast.error("Compilation error or sandbox evaluation crash.");
    } finally {
      setIsRunningCode(false);
    }
  };

  // Submit Code logic
  const handleSubmitCode = async () => {
    if (!selectedCodingQuestion || !sessionId) return;
    try {
      setIsSubmittingCode(true);
      setCodeOutputTab("results");
      setRunResults(null);

      const res = await fetch("/api/oa/submit/coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: selectedCodingQuestion.id,
          code: editorCode,
          language: codeLanguage,
          submitAll: false,
          violations,
        }),
      });

      if (!res.ok) throw new Error("Code submission failed.");
      const data = await res.json();
      setRunResults(data);
      setViolations([]);
      toast.success("Problem solution submitted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit code.");
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Submit all coding problems
  const handleCodingRoundSubmit = async () => {
    if (!sessionId) return;
    try {
      setIsSubmittingRound(true);

      // Finalize coding round state on server
      const res = await fetch("/api/oa/submit/coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: codingQuestions[0].id, // dummy req to submitAll
          code: "",
          language: "javascript",
          submitAll: true, // complete coding round!
          violations,
        }),
      });

      if (!res.ok) throw new Error("Coding round finalization failed.");

      setViolations([]);
      toast.success("Coding assessment finalized. Proceeding to Aptitude round.");
      setView("aptitude");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit coding round.");
    } finally {
      setIsSubmittingRound(false);
    }
  };

  // Aptitude Round Submit
  const handleAptitudeSubmit = async (isAuto = false) => {
    if (!sessionId) return;
    try {
      setIsSubmittingRound(true);
      const res = await fetch("/api/oa/submit/aptitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers: aptitudeAnswers,
          violations,
        }),
      });

      if (!res.ok) throw new Error("Aptitude submission failed.");
      const data = await res.json();

      setViolations([]);
      toast.success(isAuto ? "Time limit exceeded. Aptitude auto-submitted." : "Assessment completed successfully!");

      // Load completed session results
      await loadSession(sessionId);

      // E2E: link OA and auto-enter AI interview round
      if (typeof window !== "undefined") {
        const fId = getFullSessionId();
        if (fId) {
          toast.info("OA complete. Starting live AI interview...");
          await fetch("/api/interview/link-round", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullSessionId: fId,
              roundType: "oa",
              roundSessionId: sessionId
            })
          });
          localStorage.removeItem("active_oa_session_id");
          localStorage.removeItem("interview_context_oa");
          stopOAProctorStreams();
          setTimeout(() => {
            window.location.href = `/dashboard/ai?fullSessionId=${fId}`;
          }, 1200);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit Aptitude round answers.");
    } finally {
      setIsSubmittingRound(false);
    }
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
    localStorage.removeItem("active_oa_session_id");
    localStorage.removeItem("interview_context_oa");
    setSessionId(null);
    setSession(null);
    setMCQQuestions([]);
    setCodingQuestions([]);
    setAptitudeQuestions([]);
    setMCQAnswers({});
    setMCQMarked({});
    setAptitudeAnswers({});
    setAptitudeMarked({});
    setViolations([]);
    setView("setup");
  };

  // Render Time string helper
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Helper to retrieve active round status color
  const getRoundStatusBadge = (status: "not_started" | "in_progress" | "completed") => {
    switch (status) {
      case "completed":
        return <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full">Completed</span>;
      case "in_progress":
        return <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full animate-pulse">Active</span>;
      default:
        return <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2.5 py-0.5 rounded-full">Not Started</span>;
    }
  };

  const showE2EEndTest = isProctoredE2E() && [
    "overview",
    "mcq",
    "mcq_review",
    "coding_list",
    "coding_editor",
    "aptitude",
    "aptitude_review",
  ].includes(view);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {showE2EEndTest && (
        <div className="sticky top-0 z-40 -mx-2 px-2">
          <div className="flex items-center justify-between bg-white border border-[#ECECEC] rounded-lg px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-xs font-semibold text-[#111111]">
                Full Interview · Round 1 (OA)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isProctoredE2E() && (
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#6B7280] mr-1">
                  <span className={cn("inline-flex items-center gap-1", cameraStream ? "text-green-600" : "text-amber-600")}>
                    <Camera className="w-3 h-3" /> Cam
                  </span>
                  <span className={cn("inline-flex items-center gap-1", micStream ? "text-green-600" : "text-amber-600")}>
                    <Mic className="w-3 h-3" /> Mic
                  </span>
                  <span className={cn("inline-flex items-center gap-1", screenStream ? "text-green-600" : "text-amber-600")}>
                    <Monitor className="w-3 h-3" /> Screen
                  </span>
                </div>
              )}
              <button
                onClick={() => void handleEndFullTest(false)}
                disabled={endingTest}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3.5 py-1.5 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                {endingTest ? "Ending..." : "End Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isProctoredE2E() && cameraStream && isActiveExamView(view) && (
        <div className="fixed bottom-4 right-4 z-50 w-36 rounded-lg overflow-hidden border border-[#ECECEC] shadow-lg bg-black">
          <video
            ref={proctorVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-24 object-cover scale-x-[-1]"
          />
          <div className="px-2 py-1 bg-white text-[10px] font-semibold text-[#6B7280] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Proctoring
          </div>
        </div>
      )}

      {warningModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#ECECEC] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[#111111]">Proctoring Alert</h3>
            </div>
            {warningModal.type === "tab" && (
              <p className="text-sm text-[#6B7280]">
                Tab switch detected ({warningModal.count || 1}/5). Leaving this tab again may end the test.
              </p>
            )}
            {warningModal.type === "fullscreen" && (
              <p className="text-sm text-[#6B7280]">
                Fullscreen is required for this interview. Re-enter fullscreen to continue.
              </p>
            )}
            {warningModal.type === "screenshare" && (
              <p className="text-sm text-[#6B7280]">
                Screen share stopped. Restore it within {screenGraceSeconds}s or the test will end.
              </p>
            )}
            <div className="flex justify-end gap-2">
              {warningModal.type === "fullscreen" && (
                <button
                  onClick={() => void requestReFullscreen()}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
                >
                  Re-enter Fullscreen
                </button>
              )}
              {warningModal.type === "screenshare" && (
                <button
                  onClick={() => void resumeScreenShare()}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
                >
                  Restore Screen Share
                </button>
              )}
              {warningModal.type === "tab" && (
                <button
                  onClick={() => setWarningModal(null)}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
                >
                  I Understand
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!proctorReady && isProctoredE2E() && sessionId && isActiveExamView(view) && (
        <div className="fixed inset-0 z-[55] bg-white/90 flex items-center justify-center p-4">
          <div className="bg-white border border-[#ECECEC] rounded-lg p-6 max-w-md w-full space-y-4 text-center shadow-lg">
            <h3 className="text-sm font-bold text-[#111111]">Enable proctoring to continue</h3>
            <p className="text-xs text-[#6B7280]">
              Allow camera, microphone, and screen share. The assessment stays in fullscreen with tab monitoring.
            </p>
            <button
              onClick={() => {
                proctorStartedRef.current = false;
                void startOAProctoring();
              }}
              className="w-full py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Grant Camera, Mic & Screen Share
            </button>
          </div>
        </div>
      )}

      {/* ─── SETUP / CONFIGURATION SCREEN ─────────────────────────────────── */}
      {view === "setup" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">OA Round</h1>
              <p className="text-[#9CA3AF] mt-1 text-[13px]">
                Configure your profile context using your Resume, a Job Description, or a Target Role, then generate the assessment.
              </p>
            </div>

          </div>

          {!contextReady ? (
            <InterviewConfiguration
              interviewType="oa"
              onConfigurationComplete={() => {
                setContextReady(true);
              }}
            />
          ) : (
            <div className="bg-white rounded-lg border border-[#ECECEC] p-8 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-blue-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-[16px] font-semibold text-[#111111]">Interview Profile Configured!</h3>
                <p className="text-xs text-[#9CA3AF] max-w-sm">
                  We parsed your profile and are ready to generate a customized 3-stage assessment (MCQs, Coding, Aptitude).
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem("interview_context_oa");
                    setContextReady(false);
                  }}
                  className="px-4 py-2 border border-[#ECECEC] text-[13px] font-medium text-[#6B7280] rounded-lg hover:bg-gray-50 transition"
                >
                  Configure New Context
                </button>
                <button
                  onClick={handleStartAssessment}
                  disabled={isGenerating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg flex items-center gap-2 transition"
                >
                  {isGenerating ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" /> Generating Assessment...
                    </>
                  ) : (
                    <>
                      Generate OA Assessment <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── OA ROUND OVERVIEW ────────────────────────────────────────────── */}
      {view === "overview" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg border border-[#ECECEC] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[#111111]">OA Round Progress</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Complete all sections to finish your assessment.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                  <Clock className="w-3.5 h-3.5" /> Total Time: <span className="font-semibold text-[#111111]">80 mins</span>
                </div>
                {!isProctoredE2E() && (
                  <button
                    onClick={handleExit}
                    className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Exit Assessment
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: MCQ */}
              <div className="border border-[#ECECEC] rounded-lg p-5 flex flex-col justify-between h-[160px] bg-white hover:border-[#D4D4D4] transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                      <HelpCircle className="w-4 h-4" />
                    </span>
                    {getRoundStatusBadge("not_started")}
                  </div>
                  <h3 className="text-sm font-semibold text-[#111111] mt-3">MCQ Section</h3>
                  <p className="text-xs text-[#9CA3AF] mt-1">Multiple choice questions • 20 mins • 15 questions</p>
                </div>
                <button
                  onClick={() => setView("mcq")}
                  className="w-full mt-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md transition"
                >
                  Start MCQ Section
                </button>
              </div>

              {/* Card 2: Coding */}
              <div className="border border-[#ECECEC] rounded-lg p-5 flex flex-col justify-between h-[160px] bg-white opacity-70 cursor-not-allowed">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                      <Code2 className="w-4 h-4" />
                    </span>
                    {getRoundStatusBadge("not_started")}
                  </div>
                  <h3 className="text-sm font-semibold text-[#111111] mt-3">Coding Section</h3>
                  <p className="text-xs text-[#9CA3AF] mt-1">Programming challenges • 45 mins • 5 problems</p>
                </div>
                <button disabled className="w-full mt-4 py-1.5 bg-gray-100 text-gray-400 font-medium text-xs rounded-md cursor-not-allowed">
                  Locked
                </button>
              </div>

              {/* Card 3: Aptitude */}
              <div className="border border-[#ECECEC] rounded-lg p-5 flex flex-col justify-between h-[160px] bg-white opacity-70 cursor-not-allowed">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                      <Brain className="w-4 h-4" />
                    </span>
                    {getRoundStatusBadge("not_started")}
                  </div>
                  <h3 className="text-sm font-semibold text-[#111111] mt-3">Aptitude Section</h3>
                  <p className="text-xs text-[#9CA3AF] mt-1">Aptitude & reasoning • 15 mins • 10 questions</p>
                </div>
                <button disabled className="w-full mt-4 py-1.5 bg-gray-100 text-gray-400 font-medium text-xs rounded-md cursor-not-allowed">
                  Locked
                </button>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider">How it works</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-[#ECECEC] p-5 space-y-3">
                <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">1</span>
                <h4 className="text-xs font-semibold text-[#111111]">Complete MCQ section</h4>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">Answer all multiple choice questions before the timer runs out.</p>
              </div>
              <div className="bg-white rounded-lg border border-[#ECECEC] p-5 space-y-3">
                <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">2</span>
                <h4 className="text-xs font-semibold text-[#111111]">Solve coding problems</h4>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">Solve programming challenges using your preferred language stack.</p>
              </div>
              <div className="bg-white rounded-lg border border-[#ECECEC] p-5 space-y-3">
                <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">3</span>
                <h4 className="text-xs font-semibold text-[#111111]">Aptitude assessment</h4>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">Test your logical, numerical, verbal, and analytical reasoning skills.</p>
              </div>
              <div className="bg-white rounded-lg border border-[#ECECEC] p-5 space-y-3">
                <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">4</span>
                <h4 className="text-xs font-semibold text-[#111111]">Get detailed results</h4>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">View detailed performance insights, recommendations, and next steps.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MCQ ROUND QUESTION VIEW ─────────────────────────────────────── */}
      {view === "mcq" && mcqQuestions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">
          {/* Question Pane */}
          <div className="lg:col-span-3 bg-white rounded-lg border border-[#ECECEC] p-6 space-y-6 flex flex-col justify-between min-h-[480px]">
            <div>
              <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#111111]">MCQ Section</h2>
                  <p className="text-xs text-[#9CA3AF]">Multiple choice questions • 15 questions</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExit}
                    className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-lg transition font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Exit
                  </button>
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                    <Clock className="w-4 h-4" />
                    <span>Time Left: {formatTime(mcqTimeLeft)}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-4">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${((Object.keys(mcqAnswers).length) / 15) * 100}%` }}
                />
              </div>

              {/* Question Text */}
              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                  <span>Question {activeMCQIndex + 1} of 15</span>
                  <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-[#6B7280]">
                    {mcqQuestions[activeMCQIndex].skill}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#111111] leading-relaxed">
                  {mcqQuestions[activeMCQIndex].question}
                </h3>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-3 mt-6">
                {mcqQuestions[activeMCQIndex].options.map((opt, oIdx) => {
                  const qId = mcqQuestions[activeMCQIndex].id;
                  const isSelected = mcqAnswers[qId] === opt;

                  return (
                    <button
                      key={oIdx}
                      onClick={() => setMCQAnswers((prev) => ({ ...prev, [qId]: opt }))}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border text-left text-xs font-medium transition cursor-pointer",
                        isSelected
                          ? "border-blue-600 bg-blue-50/20 text-[#111111]"
                          : "border-[#ECECEC] hover:border-[#D4D4D4] hover:bg-[#F9FAFB]/50 text-[#6B7280]"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold",
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-[#ECECEC] bg-white text-[#9CA3AF]"
                      )}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-[#ECECEC] pt-4 mt-6">
              <button
                onClick={() => setMCQMarked((prev) => ({ ...prev, [mcqQuestions[activeMCQIndex].id]: !prev[mcqQuestions[activeMCQIndex].id] }))}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 border rounded-lg text-xs font-semibold transition cursor-pointer",
                  mcqMarked[mcqQuestions[activeMCQIndex].id]
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-[#ECECEC] hover:bg-gray-50 text-[#6B7280]"
                )}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                {mcqMarked[mcqQuestions[activeMCQIndex].id] ? "Marked for Review" : "Mark for Review"}
              </button>

              <div className="flex gap-2">
                <button
                  disabled={activeMCQIndex === 0}
                  onClick={() => setActiveMCQIndex((prev) => prev - 1)}
                  className="px-4 py-2 border border-[#ECECEC] rounded-lg text-xs font-semibold text-[#6B7280] hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Previous
                </button>
                {activeMCQIndex < 14 ? (
                  <button
                    onClick={() => setActiveMCQIndex((prev) => prev + 1)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={() => setView("mcq_review")}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Review & Submit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Palette Sidebar */}
          <div className="bg-white rounded-lg border border-[#ECECEC] p-5 space-y-6">
            <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider">Question Palette</h3>
            <div className="grid grid-cols-5 gap-2">
              {mcqQuestions.map((q, idx) => {
                const isCurrent = activeMCQIndex === idx;
                const isAnswered = mcqAnswers[q.id] !== undefined;
                const isMarked = mcqMarked[q.id] === true;

                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveMCQIndex(idx)}
                    className={cn(
                      "w-10 h-10 rounded-md border flex items-center justify-center text-xs font-bold transition cursor-pointer",
                      isCurrent
                        ? "border-blue-600 ring-2 ring-blue-100"
                        : "",
                      isAnswered
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isMarked
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-white border-[#ECECEC] text-[#9CA3AF] hover:border-[#D4D4D4]"
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-[#ECECEC] pt-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block" /> Answered
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" /> Marked for Review
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="w-3.5 h-3.5 rounded border border-[#ECECEC] bg-white inline-block" /> Not Answered
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MCQ REVIEW & SUBMIT ─────────────────────────────────────────── */}
      {view === "mcq_review" && (
        <div className="max-w-xl mx-auto bg-white rounded-lg border border-[#ECECEC] p-6 space-y-6 animate-in fade-in duration-200">
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-[#111111]">Review Your Answers</h2>
            <p className="text-xs text-[#9CA3AF] mt-1">Review your summary before submitting the MCQ round.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-center">
              <span className="text-[20px] font-bold text-blue-600">
                {Object.keys(mcqAnswers).length}
              </span>
              <p className="text-[10px] font-medium text-[#6B7280] mt-1">Answered</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
              <span className="text-[20px] font-bold text-amber-600">
                {Object.keys(mcqMarked).filter((k) => mcqMarked[k]).length}
              </span>
              <p className="text-[10px] font-medium text-[#6B7280] mt-1">Marked for Review</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
              <span className="text-[20px] font-bold text-gray-600">
                {15 - Object.keys(mcqAnswers).length}
              </span>
              <p className="text-[10px] font-medium text-[#6B7280] mt-1">Not Answered</p>
            </div>
          </div>

          <div className="bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-4 text-center space-y-2">
            <p className="text-xs text-[#6B7280]">
              You have answered {Object.keys(mcqAnswers).length} out of 15 questions. Make sure to re-review your marked questions before submitting.
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => setView("mcq")}
              className="px-4 py-2 border border-[#ECECEC] text-xs font-semibold text-[#6B7280] rounded-lg hover:bg-gray-50 transition"
            >
              Review Marked
            </button>
            <button
              onClick={() => handleMCQSubmit(false)}
              disabled={isSubmittingRound}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              {isSubmittingRound ? "Submitting..." : "Submit All Answers"}
            </button>
          </div>
        </div>
      )}

      {/* ─── CODING PROBLEM LIST ─────────────────────────────────────────── */}
      {view === "coding_list" && codingQuestions.length > 0 && (
        <div className="bg-white rounded-lg border border-[#ECECEC] p-6 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[#111111]">Coding Section</h2>
              <p className="text-xs text-[#9CA3AF]">Programming challenges • 5 problems</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExit}
                className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-lg transition font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" /> Exit
              </button>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                <Clock className="w-4 h-4" />
                <span>Time Left: {formatTime(codingTimeLeft)}</span>
              </div>
            </div>
          </div>

          {/* Table list */}
          <div className="divide-y divide-[#ECECEC]">
            {codingQuestions.map((q, idx) => {
              const submission = session?.codingAnswers?.[q.id];
              let statusText = "Not Started";
              let statusColor = "text-gray-400 bg-gray-50";

              if (submission) {
                if (submission.passedCount === submission.totalCount) {
                  statusText = "Solved";
                  statusColor = "text-green-600 bg-green-50";
                } else {
                  statusText = "Attempted";
                  statusColor = "text-amber-600 bg-amber-50";
                }
              }

              const diffColor =
                q.difficulty === "Easy"
                  ? "text-green-600"
                  : q.difficulty === "Medium"
                    ? "text-amber-600"
                    : "text-red-600";

              return (
                <div key={q.id} className="flex items-center justify-between py-4 group hover:bg-[#F9FAFB]/30 px-2 rounded-lg transition">
                  <div className="flex items-center gap-4">
                    <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-xs font-semibold text-[#111111]">{q.title}</h3>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate max-w-md">
                        {q.problemStatement.split("\n")[0]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", diffColor)}>
                      {q.difficulty}
                    </span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColor)}>
                      {statusText}
                    </span>
                    <button
                      onClick={() => handleSelectProblem(q)}
                      className="p-1.5 rounded-lg border border-[#ECECEC] hover:border-blue-600 hover:text-blue-600 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-[#ECECEC]">
            <button
              onClick={handleCodingRoundSubmit}
              disabled={isSubmittingRound}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              {isSubmittingRound ? "Submitting..." : "Submit All Coding Problems"}
            </button>
          </div>
        </div>
      )}

      {/* ─── CODING EDITOR & COMPILER ────────────────────────────────────── */}
      {view === "coding_editor" && selectedCodingQuestion && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200 h-[680px]">
          {/* Left panel: Problem description & outcomes */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-[#ECECEC] flex flex-col justify-between overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-[#ECECEC] bg-gray-50/50">
              <button
                onClick={() => setCodeOutputTab("description")}
                className={cn(
                  "flex-1 py-3 text-xs font-semibold transition border-b-2 cursor-pointer",
                  codeOutputTab === "description"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-[#6B7280] hover:text-[#111111]"
                )}
              >
                Problem
              </button>
              <button
                onClick={() => setCodeOutputTab("results")}
                className={cn(
                  "flex-1 py-3 text-xs font-semibold transition border-b-2 cursor-pointer",
                  codeOutputTab === "results"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-[#6B7280] hover:text-[#111111]"
                )}
              >
                Test Cases
              </button>
              <button
                onClick={() => setCodeOutputTab("submissions")}
                className={cn(
                  "flex-1 py-3 text-xs font-semibold transition border-b-2 cursor-pointer",
                  codeOutputTab === "submissions"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-[#6B7280] hover:text-[#111111]"
                )}
              >
                AI Feedback
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs text-[#6B7280] leading-relaxed">
              {/* Tab 1: Description */}
              {codeOutputTab === "description" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#111111]">
                      {selectedCodingQuestion.title}
                    </h2>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {selectedCodingQuestion.difficulty}
                    </span>
                  </div>

                  <p className="whitespace-pre-line text-[#111111]">
                    {selectedCodingQuestion.problemStatement}
                  </p>

                  {/* Constraints */}
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-[#111111]">Constraints:</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      {selectedCodingQuestion.constraints.map((c, idx) => (
                        <li key={idx}><code>{c}</code></li>
                      ))}
                    </ul>
                  </div>

                  {/* Examples */}
                  <div className="space-y-3 pt-2">
                    {selectedCodingQuestion.examples.map((ex, idx) => (
                      <div key={idx} className="bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-3 space-y-1 font-mono">
                        <span className="text-[10px] font-bold text-[#111111]">Example {idx + 1}:</span>
                        <div className="text-[11px] mt-1">
                          <span className="font-semibold text-[#111111]">Input:</span> {ex.input}
                        </div>
                        <div className="text-[11px]">
                          <span className="font-semibold text-[#111111]">Output:</span> {ex.output}
                        </div>
                        {ex.explanation && (
                          <div className="text-[11px] text-[#9CA3AF] mt-1 font-sans">
                            <span className="font-semibold text-[#111111]">Explanation:</span> {ex.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Test Cases */}
              {codeOutputTab === "results" && (
                <div className="space-y-4">
                  {isRunningCode || isSubmittingCode ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <RotateCw className="w-6 h-6 animate-spin text-blue-500" />
                      <p className="text-xs text-[#9CA3AF]">Compiling and running test cases...</p>
                    </div>
                  ) : runResults ? (
                    <div className="space-y-4">
                      {/* Summary card */}
                      <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#111111]">
                              {runResults.passed} / {runResults.total} Passed
                            </span>
                          </div>
                          <span className="text-[10px] text-[#9CA3AF] uppercase font-bold mt-1 block">
                            Status: <span className={cn(
                              runResults.compilerStatus === "Accepted" ? "text-green-600" : "text-red-600"
                            )}>{runResults.compilerStatus}</span>
                          </span>
                        </div>
                        <div className="text-right text-[11px] text-[#9CA3AF]">
                          <div>Runtime: <span className="font-semibold text-[#111111]">{runResults.runtime || "40ms"}</span></div>
                          <div>Memory: <span className="font-semibold text-[#111111]">{runResults.memory || "24.5 MB"}</span></div>
                        </div>
                      </div>

                      {/* Detail list */}
                      <div className="space-y-3">
                        {runResults.results?.map((res: any, idx: number) => {
                          const isHidden = selectedCodingQuestion.testCases[idx]?.isHidden;
                          return (
                            <div key={idx} className="border border-[#ECECEC] rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#111111]">
                                  Test Case {idx + 1} {isHidden && <span className="text-[9px] text-[#9CA3AF] font-light italic">(Hidden)</span>}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-bold uppercase",
                                  res.passed ? "text-green-600" : "text-red-600"
                                )}>
                                  {res.passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] space-y-1">
                                <div><span className="text-[#9CA3AF]">Input:</span> {res.input.replace(/\n/g, " ")}</div>
                                <div><span className="text-[#9CA3AF]">Expected:</span> {res.expected}</div>
                                <div><span className="text-[#9CA3AF]">Output:</span> {res.output}</div>
                                {res.error && (
                                  <div className="text-red-600 bg-red-50 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                                    {res.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#9CA3AF]">
                      No results to display yet. Write your code and click "Run Code".
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Submissions / AI Feedback */}
              {codeOutputTab === "submissions" && (
                <div className="space-y-4">
                  {runResults?.feedback ? (
                    <div className="space-y-4">
                      <div className="bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-4 space-y-3">
                        <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
                          <Sparkles className="w-4 h-4" />
                          <span>AI Code Analysis</span>
                        </div>

                        <div className="space-y-3 mt-2 text-xs">
                          <div>
                            <span className="font-bold text-[#111111] block">Estimated Complexity:</span>
                            <span className="font-mono text-[#6B7280]">{runResults.feedback.complexity}</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#111111] block">Code Quality:</span>
                            <p className="text-[#6B7280] mt-0.5">{runResults.feedback.codeQuality}</p>
                          </div>
                          <div>
                            <span className="font-bold text-[#111111] block">Optimization:</span>
                            <p className="text-[#6B7280] mt-0.5">{runResults.feedback.optimization}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-[#111111]">Suggestions for Improvement:</h4>
                        <div className="whitespace-pre-line text-[#6B7280] bg-gray-50/50 p-3 rounded-lg border border-[#ECECEC]">
                          {runResults.feedback.suggestions}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#9CA3AF]">
                      No review logs found. Submit your code to trigger AI reviews and optimization reports.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Back to list */}
            <div className="p-4 border-t border-[#ECECEC] bg-gray-50/50">
              <button
                onClick={() => setView("coding_list")}
                className="w-full py-2 border border-[#ECECEC] hover:bg-gray-100 font-semibold text-xs rounded-lg text-[#6B7280] transition"
              >
                Back to Problem List
              </button>
            </div>
          </div>

          {/* Right panel: Monaco Editor */}
          <div className="lg:col-span-7 bg-white rounded-lg border border-[#ECECEC] flex flex-col justify-between overflow-hidden relative">
            {/* Editor Top Bar */}
            <div className="flex items-center justify-between p-3 border-b border-[#ECECEC] bg-gray-50/50 text-xs">
              <div className="flex items-center gap-3">
                {/* Language Select */}
                <select
                  value={codeLanguage}
                  onChange={(e) => {
                    setCodeLanguage(e.target.value);
                    setEditorCode(getLanguageTemplate(e.target.value, selectedCodingQuestion));
                  }}
                  className="bg-white border border-[#ECECEC] rounded px-2.5 py-1 font-medium text-[#111111]"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>

                {/* Theme toggle */}
                <select
                  value={editorTheme}
                  onChange={(e) => setEditorTheme(e.target.value)}
                  className="bg-white border border-[#ECECEC] rounded px-2.5 py-1 font-medium text-[#111111]"
                >
                  <option value="vs-light">VS Light</option>
                  <option value="vs-dark">VS Dark</option>
                </select>
              </div>

              {/* Time display */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExit}
                  className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded transition font-semibold"
                >
                  <LogOut className="w-3 h-3" /> Exit
                </button>
                <div className="flex items-center gap-1.5 font-semibold text-[#6B7280]">
                  <Clock className="w-3.5 h-3.5" /> {formatTime(codingTimeLeft)}
                </div>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div className="flex-1 w-full bg-[#FAFAFA] min-h-[300px]">
              <Editor
                height="100%"
                language={codeLanguage}
                theme={editorTheme}
                value={editorCode}
                onChange={(val) => setEditorCode(val || "")}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  lineNumbers: "on",
                  scrollbar: {
                    vertical: "auto",
                    horizontal: "auto",
                  },
                }}
              />
            </div>

            {/* Run / Submit buttons */}
            <div className="p-4 border-t border-[#ECECEC] bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#6B7280] font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useCustomInput}
                    onChange={(e) => setUseCustomInput(e.target.checked)}
                    className="rounded border-[#ECECEC]"
                  />
                  Custom Input
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRunCode}
                  disabled={isRunningCode || isSubmittingCode}
                  className="px-4 py-2 border border-[#ECECEC] hover:bg-gray-100 text-xs font-semibold text-[#6B7280] rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {isRunningCode ? "Running..." : "Run Code"}
                </button>
                <button
                  onClick={handleSubmitCode}
                  disabled={isRunningCode || isSubmittingCode}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingCode ? "Submitting..." : "Submit Code"}
                </button>
              </div>
            </div>

            {/* Custom Input Box if checked */}
            {useCustomInput && (
              <div className="absolute bottom-16 left-4 right-4 bg-white border border-[#ECECEC] rounded-lg shadow-lg p-3 space-y-2 animate-in slide-in-from-bottom duration-150 z-20">
                <span className="text-[10px] font-bold text-[#111111] uppercase tracking-wider block">Custom Input Console:</span>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Paste inputs here..."
                  className="w-full border border-[#ECECEC] rounded p-2 text-xs font-mono h-20 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── APTITUDE ASSESSMENT ROUND ────────────────────────────────────── */}
      {view === "aptitude" && aptitudeQuestions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">
          {/* Question Box */}
          <div className="lg:col-span-3 bg-white rounded-lg border border-[#ECECEC] p-6 space-y-6 flex flex-col justify-between min-h-[480px]">
            <div>
              <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#111111]">Aptitude Section</h2>
                  <p className="text-xs text-[#9CA3AF]">Aptitude & reasoning • 10 questions</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExit}
                    className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-lg transition font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Exit
                  </button>
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                    <Clock className="w-4 h-4" />
                    <span>Time Left: {formatTime(aptitudeTimeLeft)}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-4">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${((Object.keys(aptitudeAnswers).length) / 10) * 100}%` }}
                />
              </div>

              {/* Question Text */}
              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                  <span>Question {activeAptitudeIndex + 1} of 10</span>
                  <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-[#6B7280]">
                    {aptitudeQuestions[activeAptitudeIndex].category}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#111111] leading-relaxed">
                  {aptitudeQuestions[activeAptitudeIndex].question}
                </h3>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-3 mt-6">
                {aptitudeQuestions[activeAptitudeIndex].options.map((opt, oIdx) => {
                  const qId = aptitudeQuestions[activeAptitudeIndex].id;
                  const isSelected = aptitudeAnswers[qId] === opt;

                  return (
                    <button
                      key={oIdx}
                      onClick={() => setAptitudeAnswers((prev) => ({ ...prev, [qId]: opt }))}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border text-left text-xs font-medium transition cursor-pointer",
                        isSelected
                          ? "border-blue-600 bg-blue-50/20 text-[#111111]"
                          : "border-[#ECECEC] hover:border-[#D4D4D4] hover:bg-[#F9FAFB]/50 text-[#6B7280]"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold",
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-[#ECECEC] bg-white text-[#9CA3AF]"
                      )}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-[#ECECEC] pt-4 mt-6">
              <button
                onClick={() => setAptitudeMarked((prev) => ({ ...prev, [aptitudeQuestions[activeAptitudeIndex].id]: !prev[aptitudeQuestions[activeAptitudeIndex].id] }))}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 border rounded-lg text-xs font-semibold transition cursor-pointer",
                  aptitudeMarked[aptitudeQuestions[activeAptitudeIndex].id]
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-[#ECECEC] hover:bg-gray-50 text-[#6B7280]"
                )}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                {aptitudeMarked[aptitudeQuestions[activeAptitudeIndex].id] ? "Marked for Review" : "Mark for Review"}
              </button>

              <div className="flex gap-2">
                <button
                  disabled={activeAptitudeIndex === 0}
                  onClick={() => setActiveAptitudeIndex((prev) => prev - 1)}
                  className="px-4 py-2 border border-[#ECECEC] rounded-lg text-xs font-semibold text-[#6B7280] hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Previous
                </button>
                {activeAptitudeIndex < 9 ? (
                  <button
                    onClick={() => setActiveAptitudeIndex((prev) => prev + 1)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={() => setView("aptitude_review")}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Review & Submit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Palette Sidebar */}
          <div className="bg-white rounded-lg border border-[#ECECEC] p-5 space-y-6">
            <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider">Question Palette</h3>
            <div className="grid grid-cols-5 gap-2">
              {aptitudeQuestions.map((q, idx) => {
                const isCurrent = activeAptitudeIndex === idx;
                const isAnswered = aptitudeAnswers[q.id] !== undefined;
                const isMarked = aptitudeMarked[q.id] === true;

                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveAptitudeIndex(idx)}
                    className={cn(
                      "w-10 h-10 rounded-md border flex items-center justify-center text-xs font-bold transition cursor-pointer",
                      isCurrent
                        ? "border-blue-600 ring-2 ring-blue-100"
                        : "",
                      isAnswered
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isMarked
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-white border-[#ECECEC] text-[#9CA3AF] hover:border-[#D4D4D4]"
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-[#ECECEC] pt-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block" /> Answered
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" /> Marked for Review
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="w-3.5 h-3.5 rounded border border-[#ECECEC] bg-white inline-block" /> Not Answered
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── APTITUDE REVIEW & SUBMIT ────────────────────────────────────── */}
      {view === "aptitude_review" && (
        <div className="max-w-xl mx-auto bg-white rounded-lg border border-[#ECECEC] p-6 space-y-6 animate-in fade-in duration-200">
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-[#111111]">Review Your Answers</h2>
            <p className="text-xs text-[#9CA3AF] mt-1">Review your summary before submitting the Aptitude round.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-center">
              <span className="text-[20px] font-bold text-blue-600">
                {Object.keys(aptitudeAnswers).length}
              </span>
              <p className="text-[10px] font-medium text-[#6B7280] mt-1">Answered</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
              <span className="text-[20px] font-bold text-amber-600">
                {Object.keys(aptitudeMarked).filter((k) => aptitudeMarked[k]).length}
              </span>
              <p className="text-[10px] font-medium text-[#6B7280] mt-1">Marked for Review</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
              <span className="text-[20px] font-bold text-gray-600">
                {10 - Object.keys(aptitudeAnswers).length}
              </span>
              <p className="text-[10px] font-medium text-[#6B7280] mt-1">Not Answered</p>
            </div>
          </div>

          <div className="bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-4 text-center space-y-2">
            <p className="text-xs text-[#6B7280]">
              You have answered {Object.keys(aptitudeAnswers).length} out of 10 questions. Clicking submit will finalize the entire assessment.
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => setView("aptitude")}
              className="px-4 py-2 border border-[#ECECEC] text-xs font-semibold text-[#6B7280] rounded-lg hover:bg-gray-50 transition"
            >
              Review Marked
            </button>
            <button
              onClick={() => handleAptitudeSubmit(false)}
              disabled={isSubmittingRound}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              {isSubmittingRound ? "Evaluating & Generating Report..." : "Submit All & Finalize Assessment"}
            </button>
          </div>
        </div>
      )}

      {/* ─── OA ROUND RESULTS SUMMARY ────────────────────────────────────── */}
      {view === "results" && session?.evaluation && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#111111]">OA Round Results</h1>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Assessment completed on {new Date(session.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExit}
                className="px-4 py-2 border border-[#ECECEC] bg-white hover:bg-gray-50 text-[13px] font-medium rounded-lg text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4 text-slate-500" /> Exit
              </button>
              <button
                onClick={() => setView("report")}
                className="px-4 py-2 border border-[#ECECEC] hover:bg-gray-50 text-[13px] font-medium rounded-lg text-[#6B7280] hover:text-[#111111] transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Report
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#ECECEC] p-8 flex flex-col md:flex-row items-center md:items-stretch gap-8">
            {/* Score Ring */}
            <div className="flex flex-col items-center justify-center p-4 border-r border-transparent md:border-[#ECECEC] pr-8">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* SVG Ring */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="72" cy="72" r="60" className="stroke-gray-100 fill-none" strokeWidth="12" />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-green-500 fill-none transition-all duration-1000"
                    strokeWidth="12"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - session.evaluation.overallScore / 100)}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-extrabold text-[#111111]">{session.evaluation.overallScore}%</span>
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mt-0.5">Overall Score</p>
                </div>
              </div>

              <div className="text-center mt-6 space-y-1">
                <span className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full inline-block",
                  session.evaluation.passed ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                )}>
                  {session.evaluation.passed ? "Good Performance" : "Needs More Practice"}
                </span>
                <p className="text-[11px] text-[#9CA3AF] max-w-[200px] mt-1.5">
                  {session.evaluation.passed
                    ? "You have qualified for the AI Interview Round!"
                    : "Unfortunately, you did not meet the 50% qualification score. Please try again."}
                </p>
              </div>
            </div>

            {/* Performance breakdown list */}
            <div className="flex-1 space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider mb-4">Performance Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* MCQ */}
                  <div className="border border-[#ECECEC] rounded-lg p-4 bg-gray-50/20 text-center">
                    <span className="text-[11px] font-bold text-[#6B7280] block">MCQ Section</span>
                    <span className="text-[20px] font-bold text-[#111111] mt-1.5 block">
                      {session.evaluation.mcqStats.correct} / {session.mcqQuestions.length}
                    </span>
                    <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                      {session.evaluation.mcqScore}%
                    </span>
                  </div>

                  {/* Coding */}
                  <div className="border border-[#ECECEC] rounded-lg p-4 bg-gray-50/20 text-center">
                    <span className="text-[11px] font-bold text-[#6B7280] block">Coding Section</span>
                    <span className="text-[20px] font-bold text-[#111111] mt-1.5 block">
                      {session.evaluation.codingStats.passed} / {session.evaluation.codingStats.passed + session.evaluation.codingStats.failed}
                    </span>
                    <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                      {session.evaluation.codingScore}%
                    </span>
                  </div>

                  {/* Aptitude */}
                  <div className="border border-[#ECECEC] rounded-lg p-4 bg-gray-50/20 text-center">
                    <span className="text-[11px] font-bold text-[#6B7280] block">Aptitude Section</span>
                    <span className="text-[20px] font-bold text-[#111111] mt-1.5 block">
                      {session.evaluation.aptitudeStats.correct} / {session.aptitudeQuestions.length}
                    </span>
                    <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                      {session.evaluation.aptitudeScore}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[#ECECEC] pt-6">
                <div>
                  <span className="text-[10px] text-[#9CA3AF] block uppercase font-bold">Total Time Taken</span>
                  <span className="text-sm font-semibold text-[#111111] mt-0.5 block">{session.evaluation.timeTaken} mins</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#9CA3AF] block uppercase font-bold">Accuracy</span>
                  <span className="text-sm font-semibold text-[#111111] mt-0.5 block">{session.evaluation.accuracy}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#9CA3AF] block uppercase font-bold">Cheating Alerts</span>
                  <span className="text-sm font-semibold text-red-600 mt-0.5 block">{session.violations?.length || 0}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#9CA3AF] block uppercase font-bold">Total Questions</span>
                  <span className="text-sm font-semibold text-[#111111] mt-0.5 block">
                    {session.mcqQuestions.length + session.aptitudeQuestions.length + 5}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleResetAll}
              className="px-5 py-2 border border-[#ECECEC] hover:bg-gray-50 text-xs font-semibold rounded-lg text-[#6B7280] hover:text-[#111111] transition cursor-pointer"
            >
              Configure New Assessment
            </button>
            <button
              onClick={() => setView("report")}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              View Detailed Report <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── DETAILED ASSESSMENT REPORT ───────────────────────────────────── */}
      {view === "report" && session?.report && (
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <button
              onClick={() => setView("results")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Back to results
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Print / Save PDF
            </button>
          </div>
          <InterviewReportView report={formatToUnifiedReport(session, "oa")} />
        </div>
      )}
    </div>
  );
}
