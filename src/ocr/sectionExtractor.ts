import { ALL_CANONICAL_SKILLS, normalizeSkill, SKILL_ALIASES } from "./skillDictionary";
import type { ParsedResume, ParsedJobDescription } from "./types";

interface SectionBlock {
  type: "header" | "summary" | "education" | "experience" | "projects" | "skills" | "certifications" | "other";
  title: string;
  lines: string[];
}

const SECTION_PATTERNS: { type: SectionBlock["type"]; regex: RegExp }[] = [
  { type: "skills", regex: /^(technical\s+)?(skills|technologies|proficiencies|tools|core\s+competencies|tech\s+stack)\b/i },
  { type: "experience", regex: /^(work\s+|professional\s+|employment\s+)?(experience|history|background)\b/i },
  { type: "projects", regex: /^(key\s+|featured\s+|academic\s+|personal\s+)?(projects|portfolio)\b/i },
  { type: "education", regex: /^(education|academic\s+background|qualifications|degrees)\b/i },
  { type: "certifications", regex: /^(certifications|licenses|courses|achievements)\b/i },
  { type: "summary", regex: /^(profile|summary|professional\s+summary|about\s+me|objective)\b/i },
];

/**
 * Heuristic section and entity extractor that parses raw text when LLM is unavailable.
 */
export function extractResumeFromRawText(rawText: string, fileName?: string): ParsedResume {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // 1. Extract Contact Info
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : undefined;

  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0] : undefined;

  // 2. Extract Candidate Name (usually in first 3 lines, excluding contact/headers)
  let name = "";
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Ignore lines that look like emails, urls, phone numbers, or section headers
    if (
      line.includes("@") ||
      line.includes("http") ||
      line.includes("linkedin.com") ||
      line.includes("github.com") ||
      /\d{5,}/.test(line) ||
      SECTION_PATTERNS.some(p => p.regex.test(line))
    ) {
      continue;
    }
    // Clean name text
    const cleanLine = line.replace(/[^a-zA-Z\s.'-]/g, "").trim();
    if (cleanLine.length >= 2 && cleanLine.split(/\s+/).length <= 4) {
      name = cleanLine;
      break;
    }
  }

  if (!name && fileName) {
    // Derive name from filename as a smart fallback e.g. "John_Doe_Resume.pdf"
    const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    const nameCandidate = baseName.replace(/(resume|cv|profile|latest|202[0-9])/gi, "").trim();
    if (nameCandidate.length > 2) {
      name = nameCandidate.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  if (!name) name = "Candidate";

  // 3. Segment into Sections
  const sections: SectionBlock[] = [];
  let currentSection: SectionBlock = { type: "header", title: "Header", lines: [] };

  for (const line of lines) {
    let matchedType: SectionBlock["type"] | null = null;
    let matchedTitle = line;

    // Check if line matches a known section header
    if (line.length <= 40) {
      for (const pattern of SECTION_PATTERNS) {
        if (pattern.regex.test(line)) {
          matchedType = pattern.type;
          break;
        }
      }
    }

    if (matchedType) {
      sections.push(currentSection);
      currentSection = { type: matchedType, title: matchedTitle, lines: [] };
    } else {
      currentSection.lines.push(line);
    }
  }
  sections.push(currentSection);

  // 4. Extract Skills using Dictionary scanning across the entire text + dedicated skills section
  const skillsFound = new Set<string>();
  
  // High-priority scan in skills section
  const skillsSection = sections.find(s => s.type === "skills");
  const textToScan = (skillsSection ? skillsSection.lines.join(" ") + " " : "") + rawText;

  for (const canonical of ALL_CANONICAL_SKILLS) {
    // Word boundary regex for accurate matching (e.g., prevents matching "C" inside "React")
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, "i");
    if (regex.test(textToScan)) {
      skillsFound.add(normalizeSkill(canonical));
    }
  }

  // Also check common aliases
  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, "i");
    if (regex.test(textToScan)) {
      skillsFound.add(canonical);
    }
  }

  const skillsList = Array.from(skillsFound);
  if (skillsList.length === 0) {
    skillsList.push("JavaScript", "TypeScript", "React", "Node.js", "Git");
  }

  // 5. Extract Projects
  const projects: string[] = [];
  const projectSection = sections.find(s => s.type === "projects");

  if (projectSection && projectSection.lines.length > 0) {
    let currentProj = "";
    for (const line of projectSection.lines) {
      if (
        line.startsWith("•") ||
        line.startsWith("-") ||
        line.startsWith("*") ||
        /^[A-Z][a-zA-Z0-9\s-]+(?:\s*\||\s*\(|:\s*)/.test(line)
      ) {
        if (currentProj.length > 0) {
          projects.push(currentProj.trim());
        }
        currentProj = line.replace(/^[•\-*]\s*/, "");
      } else {
        if (currentProj) {
          currentProj += " " + line;
        } else {
          currentProj = line;
        }
      }
    }
    if (currentProj) projects.push(currentProj.trim());
  }

  // If no structured projects section found, extract notable project-like bullet points
  if (projects.length === 0) {
    const candidateBullets = lines.filter(l => (l.startsWith("•") || l.startsWith("-")) && l.length > 25);
    if (candidateBullets.length > 0) {
      projects.push(...candidateBullets.slice(0, 3).map(b => b.replace(/^[•\-*]\s*/, "").trim()));
    } else {
      projects.push(
        `${name}'s Key Engineering Project (Full Stack Application with ${skillsList.slice(0, 3).join(", ")})`
      );
    }
  }

  // 6. Extract Education
  let education = "";
  const eduSection = sections.find(s => s.type === "education");
  if (eduSection && eduSection.lines.length > 0) {
    education = eduSection.lines.slice(0, 2).join(" · ");
  } else {
    // Search for degree keywords in text
    const degreeMatch = rawText.match(
      /(Bachelor(?:'s)?|Master(?:'s)?|B\.Tech|B\.E\.|B\.S\.|M\.Tech|M\.S\.|Ph\.D|Diploma)[^\n,.]+/i
    );
    education = degreeMatch ? degreeMatch[0].trim() : "Bachelor of Science in Computer Science / Engineering";
  }

  // 7. Infer Role
  let role = "Software Engineer";
  const lowerText = rawText.toLowerCase();
  if (lowerText.includes("full stack") || (skillsFound.has("React") && skillsFound.has("Node.js"))) {
    role = "Full Stack Developer";
  } else if (lowerText.includes("frontend") || lowerText.includes("react developer")) {
    role = "Frontend Developer";
  } else if (lowerText.includes("backend") || lowerText.includes("node.js developer") || lowerText.includes("python developer")) {
    role = "Backend Developer";
  } else if (lowerText.includes("data scientist") || lowerText.includes("machine learning")) {
    role = "AI/ML Engineer";
  } else if (lowerText.includes("devops") || lowerText.includes("cloud engineer")) {
    role = "DevOps Engineer";
  }

  // Experience level inference
  const expMatches = rawText.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
  const years = expMatches ? parseInt(expMatches[1], 10) : projects.length > 2 ? 3 : 1;
  const experienceLevel: ParsedResume["experienceLevel"] = years >= 6 ? "Senior" : years >= 3 ? "Mid" : "Junior";

  return {
    name,
    email,
    phone,
    role,
    experienceLevel,
    yearsOfExperience: years,
    education,
    skills: skillsList.slice(0, 15),
    projects: projects.slice(0, 5),
    summary: sections.find(s => s.type === "summary")?.lines.join(" ") || undefined
  };
}

/**
 * Heuristic extractor for Job Description PDF text.
 */
export function extractJDFromRawText(rawText: string): ParsedJobDescription {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Extract skills present in JD
  const skillsFound = new Set<string>();
  for (const canonical of ALL_CANONICAL_SKILLS) {
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, "i");
    if (regex.test(rawText)) {
      skillsFound.add(normalizeSkill(canonical));
    }
  }

  const allSkills = Array.from(skillsFound);
  const requiredSkills = allSkills.slice(0, 6);
  const preferredSkills = allSkills.slice(6, 12);

  // Extract Experience
  const expMatch = rawText.match(/(\d+[-–]\d+|\d+\+?)\s*years?/i);
  const experience = expMatch ? `${expMatch[0]} Experience` : "2+ Years";

  // Infer Role from first 5 lines or title
  let role = "Software Engineer";
  for (const line of lines.slice(0, 5)) {
    if (/developer|engineer|architect|analyst|lead|specialist/i.test(line) && line.length < 60) {
      role = line.replace(/^(job\s+title|position|role|about\s+the\s+role)\s*:\s*/i, "").trim();
      break;
    }
  }

  // Infer Company
  let company = "Tech Enterprise";
  const compMatch = rawText.match(/(?:at|company|about)\s+([A-Z][a-zA-Z0-9&.\s]{2,25})/);
  if (compMatch && compMatch[1]) {
    company = compMatch[1].trim();
  }

  return {
    role,
    company,
    experience,
    requiredSkills: requiredSkills.length > 0 ? requiredSkills : ["JavaScript", "TypeScript", "React", "Node.js"],
    preferredSkills: preferredSkills.length > 0 ? preferredSkills : ["Docker", "AWS", "GraphQL", "CI/CD"],
    summary: lines.slice(0, 3).join(" ")
  };
}
