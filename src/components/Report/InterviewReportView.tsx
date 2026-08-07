"use client";

import { useMemo, useState } from "react";
import type { UnifiedAssignmentReport } from "@/src/types";
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  FileText,
  User,
  Sparkles,
  MessageSquare,
  Code2,
  Bot,
  Volume2,
  Briefcase,
} from "lucide-react";

function typeMeta(t: string) {
  switch (t) {
    case "oa":
      return { label: "Online Assessment", Icon: Code2 };
    case "ai":
      return { label: "AI / Video Interview", Icon: Bot };
    case "audio":
      return { label: "Audio Interview", Icon: Volume2 };
    case "full":
      return { label: "Full E2E Interview", Icon: Briefcase };
    default:
      return { label: "Assessment", Icon: Award };
  }
}

function scoreTone(score: number) {
  if (score >= 75) return { ring: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500", bg: "bg-emerald-50" };
  if (score >= 60) return { ring: "border-blue-200", text: "text-blue-700", bar: "bg-blue-500", bg: "bg-blue-50" };
  if (score >= 40) return { ring: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500", bg: "bg-amber-50" };
  return { ring: "border-rose-200", text: "text-rose-700", bar: "bg-rose-500", bg: "bg-rose-50" };
}

function MetricCard({ label, score }: { label: string; score: number }) {
  const tone = scoreTone(score);
  return (
    <div className={`rounded-xl border border-[#ECECEC] ${tone.bg} p-3.5`}>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className={`font-bold ${tone.text}`}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/80 overflow-hidden border border-black/5">
        <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}

export function InterviewReportView({
  report,
  compact = false,
}: {
  report: UnifiedAssignmentReport;
  compact?: boolean;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    report.sections[0]?.id ?? null
  );
  const [showTranscript, setShowTranscript] = useState(false);
  const { label, Icon } = typeMeta(report.interviewType);
  const tone = scoreTone(report.overallScore);

  const metrics = useMemo(() => {
    const base = [
      { label: "Technical", score: report.metrics.technicalScore },
      { label: "Communication", score: report.metrics.communicationScore },
      { label: "Problem Solving", score: report.metrics.problemSolvingScore },
      { label: "Confidence", score: report.metrics.confidenceScore },
    ];
    if (report.interviewType === "oa" || report.metrics.aptitudeScore > 0) {
      base.push({ label: "Aptitude", score: report.metrics.aptitudeScore });
    }
    // Hide zero-only soft metrics for OA (no verbal round)
    if (report.interviewType === "oa") {
      return [
        { label: "MCQ / Technical", score: report.metrics.technicalScore },
        { label: "Coding / PS", score: report.metrics.problemSolvingScore },
        { label: "Aptitude", score: report.metrics.aptitudeScore },
      ];
    }
    return base.filter((m) => !(report.interviewType !== "oa" && m.score === 0 && m.label === "Aptitude"));
  }, [report]);

  const formattedDate = new Date(report.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`space-y-5 ${compact ? "" : "pb-8"}`}>
      {/* Hero */}
      <section className="bg-white border border-[#ECECEC] rounded-2xl p-6 md:p-8 shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.06),transparent_50%)] pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {report.durationMinutes} min
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#111111] tracking-tight">
              {report.role}
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              {report.candidateName}
            </p>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {report.finalVerdict}
            </p>
          </div>

          <div className={`flex items-center gap-4 rounded-2xl border ${tone.ring} ${tone.bg} px-5 py-4 min-w-[220px]`}>
            <div className={`w-24 h-24 rounded-full border-4 ${tone.ring} bg-white flex flex-col items-center justify-center shadow-sm`}>
              <span className={`text-3xl font-black ${tone.text} leading-none`}>
                {report.overallScore}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-1">
                Score
              </span>
            </div>
            <div className="space-y-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  report.passed
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {report.passed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" /> Needs Practice
                  </>
                )}
              </span>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {report.proctoring.status === "Clean" ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                )}
                Proctoring: {report.proctoring.status}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="bg-white border border-[#ECECEC] rounded-2xl p-5 md:p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          Competency Breakdown
        </h3>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${metrics.length > 3 ? "lg:grid-cols-5" : "lg:grid-cols-3"} gap-3`}>
          {metrics.map((m) => (
            <MetricCard key={m.label} label={m.label} score={m.score} />
          ))}
        </div>
      </section>

      {/* Insights */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#ECECEC] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Strengths
          </div>
          <ul className="space-y-2">
            {(report.strengths.length ? report.strengths : ["No material strengths identified."]).map(
              (s, i) => (
                <li
                  key={i}
                  className="text-xs text-slate-700 bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2 leading-relaxed"
                >
                  {s}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="bg-white border border-[#ECECEC] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Gaps & Improvements
          </div>
          <ul className="space-y-2">
            {(report.weaknesses.length ? report.weaknesses : ["No major gaps recorded."]).map(
              (s, i) => (
                <li
                  key={i}
                  className="text-xs text-slate-700 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed"
                >
                  {s}
                </li>
              )
            )}
          </ul>
        </div>
      </section>

      {/* Action plan */}
      <section className="bg-slate-950 text-white rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Sparkles className="w-4 h-4 text-blue-300" />
          Personalized Action Plan
        </div>
        <div className="flex flex-wrap gap-2">
          {(report.recommendations.length
            ? report.recommendations
            : ["Review weak questions below and retry with structured answers."]
          ).map((rec, i) => (
            <span
              key={i}
              className="text-xs bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-slate-100"
            >
              {rec}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-4">
          {report.proctoring.tabSwitches} tab switches · {report.proctoring.fullscreenExits} fullscreen
          exits · {report.proctoring.violationsCount} total violations
        </p>
      </section>

      {/* Detailed sections */}
      <section className="bg-white border border-[#ECECEC] rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-blue-500" />
          Detailed Analysis
        </h3>

        {report.sections.map((sec) => {
          const open = expandedSection === sec.id;
          const secTone = scoreTone(sec.score);
          return (
            <div key={sec.id} className="border border-[#ECECEC] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedSection(open ? null : sec.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[#FAFAFA] hover:bg-[#F3F4F6] text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#111111]">{sec.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${secTone.bg} ${secTone.text} ${secTone.ring}`}>
                      {sec.score}/{sec.maxScore}
                    </span>
                  </div>
                  {sec.summary && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sec.summary}</p>
                  )}
                </div>
                {open ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {open && sec.items && (
                <div className="divide-y divide-slate-100 bg-white">
                  {sec.items.map((item, idx) => (
                    <div key={idx} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold text-[#111111] leading-relaxed">
                          <span className="text-slate-400 font-medium mr-1">Q{idx + 1}.</span>
                          {item.question}
                        </p>
                        {item.status && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border ${
                              ["Correct", "Passed", "Strong", "Adequate"].includes(item.status)
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ["Skipped", "Info"].includes(item.status)
                                  ? "bg-slate-50 text-slate-500 border-slate-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {item.status}
                            {typeof item.score === "number" ? ` · ${item.score}%` : ""}
                          </span>
                        )}
                      </div>

                      {item.answer && (
                        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="font-semibold text-slate-500">Response: </span>
                          {item.answer}
                        </div>
                      )}

                      {item.userCode && (
                        <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto">
                          {item.userCode}
                        </pre>
                      )}

                      {item.testCasesPassed !== undefined && item.totalTestCases !== undefined && (
                        <p className="text-[11px] text-slate-500">
                          Test cases: {item.testCasesPassed}/{item.totalTestCases}
                        </p>
                      )}

                      {item.correctAnswer && item.status !== "Correct" && (
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                          <strong>Correct:</strong> {item.correctAnswer}
                        </p>
                      )}

                      {item.explanation && (
                        <p className="text-[11px] text-slate-500 italic">{item.explanation}</p>
                      )}

                      {item.feedback && (
                        <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <strong>Feedback:</strong> {item.feedback}
                        </p>
                      )}

                      {item.metrics && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Object.entries(item.metrics).map(([k, v]) =>
                            typeof v === "number" ? (
                              <span
                                key={k}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {k}: {v}%
                              </span>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Transcript */}
      {report.transcript && report.transcript.length > 0 && (
        <section className="bg-white border border-[#ECECEC] rounded-2xl p-5 md:p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-[#111111]"
          >
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Full Transcript
            </span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTranscript && (
            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
              {report.transcript.map((line, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <span
                    className={`shrink-0 w-16 text-center font-semibold rounded-md px-1.5 py-1 ${
                      line.speaker === "AI"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {line.speaker}
                  </span>
                  <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-slate-700 leading-relaxed">
                    {line.text}
                    <div className="text-[10px] text-slate-400 mt-1">{line.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
