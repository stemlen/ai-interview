import type { InterviewContext } from "@/src/types";
import type { ParsedResume, ParsedJobDescription } from "@/src/ocr";

/**
 * Extracts and structures resume context from an uploaded PDF file using the OCR engine.
 */
export async function parseResume(file: File): Promise<InterviewContext> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/ocr/parse-resume", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to extract and parse resume PDF.");
  }

  const json = await res.json();
  const resume: ParsedResume = json.resume;

  return {
    source: "resume",
    role: resume.role || "Software Engineer",
    resume: {
      name: resume.name || "Candidate",
      skills: resume.skills || [],
      projects: resume.projects || [],
      education: resume.education || "Undergraduate / Graduate Degree",
    },
  };
}

/**
 * Extracts and structures Job Description context from an uploaded PDF file using the OCR engine.
 */
export async function parseJobDescription(file: File): Promise<InterviewContext> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/ocr/parse-jd", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to extract and parse Job Description PDF.");
  }

  const json = await res.json();
  const jd: ParsedJobDescription = json.jd;

  return {
    source: "jd",
    role: jd.role || "Software Engineer",
    jd: {
      company: jd.company || "Hiring Company",
      experience: jd.experience || "2+ Years",
      requiredSkills: jd.requiredSkills || [],
      preferredSkills: jd.preferredSkills || [],
    },
  };
}
