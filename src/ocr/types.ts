export interface ParsedResume {
  name: string;
  email?: string;
  phone?: string;
  role: string;
  experienceLevel: "Junior" | "Mid" | "Senior" | "Lead";
  yearsOfExperience: number;
  education: string;
  skills: string[];
  projects: string[];
  workExperience?: string[];
  summary?: string;
}

export interface ParsedJobDescription {
  role: string;
  company: string;
  experience: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities?: string[];
  summary?: string;
}

export type ExtractionMethod =
  | "gemini-multimodal-ocr"
  | "pdf-text-llm"
  | "heuristic-ocr";

export interface ExtractionMetadata {
  method: ExtractionMethod;
  pageCount: number;
  extractedAt: string;
  confidence: number;
}

export interface ResumeExtractionResult {
  data: ParsedResume;
  metadata: ExtractionMetadata;
  rawText?: string;
}

export interface JDExtractionResult {
  data: ParsedJobDescription;
  metadata: ExtractionMetadata;
  rawText?: string;
}
