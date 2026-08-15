import type { InterviewType } from "@/src/types";

// ─── Navigation Items ───────────────────────────────────────────
export const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    iconName: "Home" as const,
  },
  {
    label: "Past Assignments",
    href: "/dashboard/assignments",
    iconName: "FileText" as const,
  },
  {
    label: "OA Round",
    href: "/dashboard/oa",
    iconName: "Code2" as const,
  },
  {
    label: "AI Interview Round",
    href: "/dashboard/ai",
    iconName: "Bot" as const,
  },
  {
    label: "Audio Interview",
    href: "/dashboard/audio",
    iconName: "Volume2" as const,
  },
  {
    label: "Full End-to-End Interview",
    href: "/dashboard/interview",
    iconName: "Mic" as const,
  },
] as const;

// ─── Interview Types ────────────────────────────────────────────
export const INTERVIEW_TYPE_MAP: Record<string, InterviewType> = {
  "/dashboard/interview": "full",
  "/dashboard/oa": "oa",
  "/dashboard/ai": "ai",
  "/dashboard/audio": "audio",
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  full: "Full End-to-End Interview",
  oa: "OA Round",
  ai: "AI Interview Round",
  audio: "Audio Interview",
};

// ─── File Upload ────────────────────────────────────────────────
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const ACCEPTED_FILE_TYPES = ["application/pdf"];
export const ACCEPTED_FILE_EXTENSIONS = [".pdf"];

// ─── Routes ─────────────────────────────────────────────────────
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  ASSIGNMENTS: "/dashboard/assignments",
  INTERVIEW: "/dashboard/interview",
  OA: "/dashboard/oa",
  AI: "/dashboard/ai",
  AUDIO: "/dashboard/audio",
} as const;

// ─── Appwrite ───────────────────────────────────────────────────
export const APPWRITE_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "",
  usersCollectionId: process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID || "",
  jdCollectionId: process.env.NEXT_PUBLIC_APPWRITE_JD_COLLECTION_ID || "",
  storageBucketId: process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || "",
  oaCollectionId: process.env.NEXT_PUBLIC_APPWRITE_OA_COLLECTION_ID || "oa_collection",
  aiCollectionId: process.env.NEXT_PUBLIC_APPWRITE_AI_COLLECTION_ID || "ai_collection",
  audioCollectionId: process.env.NEXT_PUBLIC_APPWRITE_AUDIO_COLLECTION_ID || "audio_collection",
  fullCollectionId: process.env.NEXT_PUBLIC_APPWRITE_FULL_COLLECTION_ID || "full_collection",
} as const;
