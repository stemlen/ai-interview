import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/src/constants";

export function UpcomingInterviews() {
  return (
    <div className="bg-white rounded-lg border border-[#ECECEC] p-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[16px] font-medium text-[#111111]">
          Upcoming Interviews
        </h3>
        <Link
          href={ROUTES.ASSIGNMENTS}
          className="text-xs font-medium text-[#6B7280] hover:text-[#111111] px-3 py-1.5 rounded-lg border border-[#ECECEC] hover:border-[#D4D4D4] transition-all duration-150"
        >
          View all
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center py-8 text-center">
        {/* Illustration */}
        <div className="relative w-48 h-32 mb-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end gap-1">
              <div className="w-6 h-12 bg-blue-50 rounded-lg" />
              <div className="w-6 h-16 bg-blue-100 rounded-lg" />
              <div className="w-6 h-20 bg-blue-200/80 rounded-lg" />
              <div className="w-6 h-14 bg-blue-300/70 rounded-lg" />
              <div className="relative">
                <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 6v6l4 2"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h4 className="text-[14px] font-semibold text-[#111111] mb-1">
          You&apos;re all caught up!
        </h4>
        <p className="text-[13px] text-[#9CA3AF] mb-5">
          No upcoming interviews scheduled.
        </p>

        <Link
          href={ROUTES.INTERVIEW}
          className="px-5 py-2 bg-[#111111] text-white text-[13px] font-medium rounded-xl hover:bg-[#222222] transition-colors duration-150 inline-block"
        >
          Start a New Interview
        </Link>
      </div>
    </div>
  );
}
