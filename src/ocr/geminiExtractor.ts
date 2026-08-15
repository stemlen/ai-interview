import type { ParsedResume, ParsedJobDescription } from "./types";

function getApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    null
  );
}

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
];

const RESUME_EXTRACTION_PROMPT = `
You are an expert AI Resume Parser & OCR Engine.
Analyze the provided resume document and extract ALL relevant information into strict structured JSON.

Rules:
1. "name": The exact full candidate name from the top header/profile.
2. "email": Email address if present.
3. "phone": Phone number if present.
4. "role": The primary title or candidate target specialization (e.g., "Full Stack Developer", "Backend Engineer", "MERN Stack Developer", "Data Scientist", "Frontend Engineer").
5. "experienceLevel": "Junior" | "Mid" | "Senior" | "Lead" (estimate based on work history and graduation).
6. "yearsOfExperience": Integer estimating total years of professional experience (0 for fresh graduates).
7. "education": Highest degree and university name (e.g. "B.Tech in Computer Science, Stanford University (2024)").
8. "skills": Array of all technical skills, frameworks, languages, databases, tools, cloud platforms explicitly mentioned or demonstrated. Extract at least 5-20 distinct skills.
9. "projects": Array of strings representing candidate's notable projects. Each entry should format as "Project Title: Description of project, tech stack used, and key accomplishments."
10. "workExperience": Array of strings describing past roles/companies/internships if present.
11. "summary": A brief 1-2 sentence professional summary of the candidate.

Return ONLY valid JSON matching this schema:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "role": "string",
  "experienceLevel": "Junior" | "Mid" | "Senior" | "Lead",
  "yearsOfExperience": number,
  "education": "string",
  "skills": ["string"],
  "projects": ["string"],
  "workExperience": ["string"],
  "summary": "string"
}
`;

const JD_EXTRACTION_PROMPT = `
You are an expert Job Description (JD) Analyzer.
Analyze the provided Job Description document and extract key requirements into strict structured JSON.

Rules:
1. "role": The target job title/role (e.g., "Senior Backend Engineer", "Frontend Developer").
2. "company": The hiring company or organization name.
3. "experience": Experience requirements (e.g., "2-4 Years", "Fresher / 0-1 Years").
4. "requiredSkills": Array of mandatory technical skills, languages, frameworks, or tools.
5. "preferredSkills": Array of nice-to-have/preferred technical skills.
6. "responsibilities": Array of main job responsibilities or tasks.
7. "summary": Brief 1-2 sentence summary of what this role entails.

Return ONLY valid JSON matching this schema:
{
  "role": "string",
  "company": "string",
  "experience": "string",
  "requiredSkills": ["string"],
  "preferredSkills": ["string"],
  "responsibilities": ["string"],
  "summary": "string"
}
`;

/**
 * Extracts structured resume data from a base64 PDF using Gemini's native multimodal OCR.
 */
export async function extractResumeWithGeminiMultimodal(
  pdfBase64: string
): Promise<ParsedResume | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: RESUME_EXTRACTION_PROMPT },
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: pdfBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text) as ParsedResume;
      if (parsed.name && Array.isArray(parsed.skills)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Gemini multimodal extraction with ${model} failed:`, err);
    }
  }

  return null;
}

/**
 * Extracts structured resume data from raw text using Gemini text completion.
 */
export async function extractResumeWithGeminiText(
  rawText: string
): Promise<ParsedResume | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${RESUME_EXTRACTION_PROMPT}\n\nDOCUMENT TEXT CONTENT:\n${rawText}` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text) as ParsedResume;
      if (parsed.name && Array.isArray(parsed.skills)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Gemini text extraction with ${model} failed:`, err);
    }
  }

  return null;
}

/**
 * Extracts structured Job Description data from a base64 PDF using Gemini's native multimodal OCR.
 */
export async function extractJDWithGeminiMultimodal(
  pdfBase64: string
): Promise<ParsedJobDescription | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: JD_EXTRACTION_PROMPT },
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: pdfBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text) as ParsedJobDescription;
      if (parsed.role && Array.isArray(parsed.requiredSkills)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Gemini multimodal JD extraction with ${model} failed:`, err);
    }
  }

  return null;
}

/**
 * Extracts structured Job Description data from raw text using Gemini text completion.
 */
export async function extractJDWithGeminiText(
  rawText: string
): Promise<ParsedJobDescription | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${JD_EXTRACTION_PROMPT}\n\nJOB DESCRIPTION TEXT CONTENT:\n${rawText}` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text) as ParsedJobDescription;
      if (parsed.role && Array.isArray(parsed.requiredSkills)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Gemini text JD extraction with ${model} failed:`, err);
    }
  }

  return null;
}
