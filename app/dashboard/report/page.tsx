"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/src/components/providers/AuthProvider";
import type { UnifiedAssignmentReport } from "@/src/types";
import { InterviewReportView } from "@/src/components/Report/InterviewReportView";
import { ArrowLeft, Printer, Sparkles, Loader2, XCircle } from "lucide-react";

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");

  const [report, setReport] = useState<UnifiedAssignmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided in request.");
      setLoading(false);
      return;
    }

    async function fetchReport() {
      try {
        const url = `/api/report?sessionId=${sessionId}${type ? `&type=${type}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load detailed report.");
        }
        const data = await res.json();
        setReport(data.report);
      } catch (err: any) {
        console.error("Error loading report:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [sessionId, type]);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs font-medium">Loading interview report…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-[#111111]">Report Not Available</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">{error || "Could not find session data."}</p>
        <Link
          href="/dashboard/assignments"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Past Assignments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#ECECEC] hover:bg-[#F9FAFB] text-[#111111] text-xs font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <Link
            href="/dashboard/assignments"
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            All Past Assignments
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#ECECEC] hover:bg-[#F9FAFB] text-[#111111] text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-gray-500" />
            Print / Save PDF
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            New Assessment
          </Link>
        </div>
      </div>

      <InterviewReportView report={report} />
    </div>
  );
}

export default function DetailedReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
