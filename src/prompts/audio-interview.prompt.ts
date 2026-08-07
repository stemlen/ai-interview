import { InterviewBlueprint, AIQuestion, AudioInterviewSession, AudioInterviewSettings } from "../types";

export const audioInterviewPrompts = {
  /**
   * Pre-generate the full question list before the live interview starts.
   */
  getAudioBatchQuestionsPrompt(
    blueprint: InterviewBlueprint,
    settings: AudioInterviewSettings,
    count: number
  ): string {
    const role = blueprint.role || "Software Engineer";
    const experience = blueprint.experienceLevel || "Junior/Mid";
    const skills = blueprint.skills.join(", ");
    const projects = blueprint.projects.map((p: any) => `${p.title}: ${p.description}`).join("; ");

    let modeDirective = "";
    switch (settings.practiceMode) {
      case "Rapid Fire":
        modeDirective =
          "RAPID FIRE MODE: Ask quick, crisp, conceptual questions that can be answered in 1-2 sentences.";
        break;
      case "Deep Technical":
        modeDirective =
          "DEEP TECHNICAL MODE: Ask in-depth questions targeting frameworks, runtime internals, and code-level reasoning.";
        break;
      case "Behavioral Practice":
        modeDirective =
          "BEHAVIORAL MODE: Soft skills, communication, leadership, and conflict resolution (STAR format).";
        break;
      case "Project Discussion":
        modeDirective = `PROJECT DISCUSSION MODE: Focus on these projects: ${projects}.`;
        break;
      case "HR Round":
        modeDirective =
          "HR ROUND MODE: Standard HR questions (career goals, motivation, culture fit).";
        break;
      case "System Design":
        modeDirective =
          "SYSTEM DESIGN MODE: Scalability, databases, microservices, caching, rate limiting.";
        break;
    }

    return `You are a Senior Technical Interviewer preparing a full AUDIO mock interview script in advance.
Candidate Role: ${role}
Experience Level: ${experience}
Target Skills: ${skills}
Interview Type: ${settings.interviewType}
Practice Mode: ${settings.practiceMode}
Difficulty: ${settings.difficulty === "Adaptive" ? "Medium (varied depth across the set)" : settings.difficulty}

${modeDirective}

Generate exactly ${count} interview questions as a complete ordered script.
Guidelines:
1. Question 1 should briefly greet the candidate and ask an introductory technical question.
2. Cover a diverse mix of the target skills and projects — do not repeat the same topic.
3. Progress from easier/foundational to deeper questions.
4. Do NOT use markdown (**, _, \`, headers). Questions will be read aloud by TTS.
5. Keep each question brief (1-3 sentences) and ask exactly one clear question per item.
6. Do NOT include answers or multiple-choice options.

You MUST respond ONLY with a JSON object in this format:
{
  "questions": ["question 1 text", "question 2 text", "... exactly ${count} strings"]
}
`;
  },

  /**
   * Prompt to generate the next question (or follow-up) for Audio Interview
   */
  getAudioQuestionPrompt(blueprint: InterviewBlueprint, settings: AudioInterviewSettings, history: AIQuestion[]): string {
    const role = blueprint.role || "Software Engineer";
    const experience = blueprint.experienceLevel || "Junior/Mid";
    const skills = blueprint.skills.join(", ");
    const projects = blueprint.projects.map((p: any) => `${p.title}: ${p.description}`).join("; ");

    // Format previous QA history
    const historyText = history.map((q, idx) => {
      const evalInfo = q.evaluation ? ` (Score: ${q.evaluation.score}/100, Tech: ${q.evaluation.technicalAccuracy}/10)` : "";
      return `Q${idx + 1}: ${q.questionText}\nCandidate Answer: ${q.answerText || "(No answer/Skipped)"}${evalInfo}`;
    }).join("\n\n");

    // Adaptive mode details
    let adaptiveDirective = "";
    if (settings.difficulty === "Adaptive") {
      adaptiveDirective = `
ADAPTIVE DIFFICULTY DIRECTIVE:
1. Review the candidate's performance on the most recent question.
2. If the last answer score was >= 80 (or technicalAccuracy >= 8), increase the technical depth and difficulty of the next question.
3. If the last answer score was < 50 (or they struggled/skipped), reduce the difficulty to a more basic, foundational concept.
4. If they performed in the average range (50-79), maintain the current difficulty level.
`;
    }

    // Practice mode specific directives
    let modeDirective = "";
    switch (settings.practiceMode) {
      case "Rapid Fire":
        modeDirective = "RAPID FIRE MODE: Ask quick, crisp, conceptual questions that can be answered in 1-2 sentences. Avoid complex multi-part questions.";
        break;
      case "Deep Technical":
        modeDirective = "DEEP TECHNICAL MODE: Ask in-depth questions targeting specific frameworks, code syntax, or runtime internals. Feel free to ask a follow-up to probe their previous answers.";
        break;
      case "Behavioral Practice":
        modeDirective = "BEHAVIORAL MODE: Ask questions targeting soft skills, communication, leadership, and conflict resolution. Encourage STAR formatting (Situation, Task, Action, Result).";
        break;
      case "Project Discussion":
        modeDirective = `PROJECT DISCUSSION MODE: Focus on the candidate's projects listed here: ${projects}. Ask details about their architecture, choice of libraries, or challenges they solved.`;
        break;
      case "HR Round":
        modeDirective = "HR ROUND MODE: Ask standard HR questions (e.g., 'Where do you see yourself in 5 years?', 'Why do you want to join us?', salary alignment, work culture).";
        break;
      case "System Design":
        modeDirective = "SYSTEM DESIGN MODE: Ask questions about building scalable architectures, database partitioning, microservices design, caching strategies, or rate limiters.";
        break;
    }

    return `You are a Senior Technical Interviewer conducting a mock AUDIO-ONLY (voice call style) interview.
Candidate Role: ${role}
Experience Level: ${experience}
Target Skills: ${skills}
Interview Type: ${settings.interviewType}
Practice Mode: ${settings.practiceMode}
Settings Difficulty: ${settings.difficulty}

${adaptiveDirective}
${modeDirective}

Here is the conversation history so far:
${historyText || "No questions have been asked yet. Greet the candidate briefly (e.g. 'Hello, welcome to your audio mock interview! Let's get started.') and ask the first conceptual question."}

Your task is to generate the next question.
Guidelines:
1. Review the conversation history. Keep the interview flowing naturally like a real phone call.
2. Do NOT use markdown tags (such as **, _, \`\`, or headers) in your question. The question will be read aloud by browser Text-to-Speech (SpeechSynthesis API) and markdown symbols sound disruptive.
3. Keep the question extremely brief (1-3 sentences max) and direct.
4. Do NOT output multiple choice options or answers. Ask one clear question.

You MUST respond ONLY with a JSON object in this format:
{
  "questionText": "Your clean text-to-speech question here"
}
`;
  },

  /**
   * Prompt to evaluate a single answer
   */
  getAudioAnswerEvaluationPrompt(question: string, answer: string): string {
    return `You are a Technical Interview Evaluator. Evaluate the candidate's verbal answer to the question below:

Question: ${question}
Candidate Answer: ${answer}

Evaluate the response based on these 7 metrics (each out of 10):
- Technical Accuracy (0-10): correctness of facts, concepts, and terminologies
- Communication (0-10): clarity, structured explanation, and articulation
- Confidence (0-10): assertiveness, hesitation, filler words used
- Problem Solving (0-10): approach to the scenario or design question
- Vocabulary (0-10): appropriate use of industry-standard jargon
- Completeness (0-10): covers all parts of the question asked
- Practical Knowledge (0-10): usage of real-world patterns, examples, or projects

Also compute a total overall score (0-100) and provide constructive, direct feedback (1-3 sentences) detailing what they got right and what was missing.

You MUST respond ONLY with a JSON object in this format:
{
  "technicalAccuracy": number,
  "communication": number,
  "problemSolving": number,
  "confidence": number,
  "completeness": number,
  "practicalKnowledge": number,
  "feedback": "string",
  "score": number
}
`;
  },

  /**
   * Prompt to generate the final interview report
   */
  getAudioReportPrompt(session: AudioInterviewSession): string {
    const role = session.blueprint.role || "Software Engineer";
    const historyText = session.questions.map((q, idx) => {
      const evalText = q.evaluation
        ? `Score: ${q.evaluation.score}/100, Feedback: ${q.evaluation.feedback}`
        : "No evaluation";
      return `Q${idx + 1}: ${q.questionText}\nCandidate: ${q.answerText || "(Skipped)"}\nEvaluation: ${evalText}`;
    }).join("\n\n");

    return `You are a Senior Mock Interview Director. Compile a final comprehensive Interview Report for this Audio-Only Mock Interview session.

Candidate Role: ${role}
Total Questions Asked: ${session.questions.length}
Practice Mode: ${session.settings.practiceMode}
Difficulty Level: ${session.settings.difficulty}

Conversation Transcript and Performance:
${historyText}

Based on this session, generate a comprehensive evaluation matching this TypeScript interface structure.
In the recommendations list, make sure to suggest specific coaching/practice directives.

You MUST respond ONLY with a JSON object in this format:
{
  "candidateSummary": {
    "overallScore": number,
    "technicalScore": number,
    "communicationScore": number,
    "problemSolvingScore": number,
    "confidenceScore": number,
    "duration": "e.g. 12:45"
  },
  "questionFeedback": [
    {
      "question": "string",
      "answer": "string",
      "score": number,
      "feedback": "string",
      "metrics": {
        "accuracy": number,
        "communication": number,
        "problemSolving": number,
        "confidence": number
      }
    }
  ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"],
  "transcript": [
    { "speaker": "AI" | "Candidate", "text": "string", "timestamp": "string" }
  ],
  "timeline": [
    { "timestamp": "string", "label": "string" }
  ],
  "proctoringSummary": {
    "tabSwitches": number,
    "fullscreenExits": number,
    "screenShareInterruptions": number,
    "status": "Clean"
  }
}
`;
  }
};
