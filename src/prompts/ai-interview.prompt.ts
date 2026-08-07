import { InterviewBlueprint, AIQuestion, AIInterviewSession } from "../types";

export const aiInterviewPrompts = {
  /**
   * Pre-generate the full question list before the live video interview starts.
   */
  getAIBatchQuestionsPrompt(blueprint: InterviewBlueprint, count: number): string {
    const role = blueprint.role || "Software Engineer";
    const experience = blueprint.experienceLevel || "Junior/Mid";
    const skills = blueprint.skills.join(", ");
    const projects = blueprint.projects.map((p: any) => `${p.title}: ${p.description}`).join("; ");

    return `You are a Senior Technical Interviewer preparing a complete mock technical interview script in advance for a ${role} position (Experience Level: ${experience}).
Target Skills: ${skills}
Highlighted Projects: ${projects}

Generate exactly ${count} interview questions as a complete ordered script.
Guidelines:
1. Question 1 should introduce yourself briefly and ask a solid introductory technical question.
2. Cover different skills/projects across the set — avoid repeating the same sub-topic.
3. Include a mix of conceptual, practical, debugging, and project/architecture questions.
4. Progress from foundational to deeper topics.
5. Keep each question conversational and brief (1-3 sentences).
6. Do NOT provide answers or multiple choice options.

You MUST respond ONLY with a JSON object in this format:
{
  "questions": ["question 1 text", "question 2 text", "... exactly ${count} strings"]
}
`;
  },

  /**
   * Prompt to generate the next question (or follow-up)
   */
  getAIQuestionPrompt(blueprint: InterviewBlueprint, history: AIQuestion[]): string {
    const role = blueprint.role || "Software Engineer";
    const experience = blueprint.experienceLevel || "Junior/Mid";
    const skills = blueprint.skills.join(", ");
    const projects = blueprint.projects.map((p: any) => `${p.title}: ${p.description}`).join("; ");

    // Format previous QA history
    const historyText = history.map((q, idx) => {
      return `Q${idx + 1}: ${q.questionText}\nCandidate Answer: ${q.answerText || "(No answer/Skipped)"}`;
    }).join("\n\n");

    return `You are a Senior Technical Interviewer conducting a mock technical interview for a ${role} position (Experience Level: ${experience}).
Target Skills: ${skills}
Highlighted Projects: ${projects}

Here is the conversation history so far:
${historyText || "No questions have been asked yet. Introduce yourself and ask the first conceptual question based on the role and skills."}

Your task is to generate the next question.
Guidelines:
1. Review the conversation history. If the candidate's last answer was brief or needs probing, ask a deeper follow-up question. Do not exceed 2 consecutive follow-up questions on the same sub-topic/skill.
2. If the last topic was sufficiently covered or 2 follow-ups have been asked, select a different skill from the Target Skills or probe one of the Highlighted Projects.
3. Keep the question conversational, brief (1-3 sentences max), and technical.
4. If this is the start (no history), greet the candidate and ask a solid introductory technical question.
5. Do NOT provide answers or multiple choice options. Speak directly to the candidate.

You MUST respond ONLY with a JSON object in this format:
{
  "questionText": "Your question here"
}
`;
  },

  /**
   * Prompt to evaluate a single answer
   */
  getAIAnswerEvaluationPrompt(question: string, answer: string): string {
    return `You are a Technical Interview Evaluator. Evaluate the candidate's answer to the technical question below:

Question: ${question}
Candidate Answer: ${answer}

Evaluate the response based on the following metrics:
- Technical Accuracy (0-10): correctness of facts, concepts, and terminologies
- Communication (0-10): clarity, structured explanation, and articulation
- Problem Solving (0-10): approach to the scenario or design question
- Confidence (0-10): hesitation, assertiveness, tone inferred from the transcript
- Completeness (0-10): covers all parts of the question asked
- Practical Knowledge (0-10): usage of real-world patterns, examples, or projects

Also, compute a total overall score (0-100) and provide constructive, direct feedback (1-3 sentences) detailing what they got right and what was missing.

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
  getAIReportPrompt(session: AIInterviewSession): string {
    const role = session.blueprint.role || "Software Engineer";
    const historyText = session.questions.map((q, idx) => {
      const evalText = q.evaluation
        ? `Score: ${q.evaluation.score}/100, Feedback: ${q.evaluation.feedback}`
        : "No evaluation";
      return `Q${idx + 1}: ${q.questionText}\nCandidate: ${q.answerText || "(Skipped)"}\nEvaluation: ${evalText}`;
    }).join("\n\n");

    const tabSwitches = session.violations.filter(v => v.type === "tab_switch").length;
    const fullscreenExits = session.violations.filter(v => v.type === "fullscreen_exit").length;
    const screenShareInterruptions = session.violations.filter(v => v.type === "screen_share_interrupted").length;

    return `You are a Senior HR & Technical Panel Director. Compile a final comprehensive Interview Report for a mock interview session.

Candidate Role: ${role}
Total Questions Asked: ${session.questions.length}
Proctoring Violations:
- Tab Switches: ${tabSwitches}
- Fullscreen Exits: ${fullscreenExits}
- Screen Share Drops: ${screenShareInterruptions}

Conversation Transcript and Performance:
${historyText}

Based on this session, generate:
1. Candidate Summary: Overall interview score (0-100), and section scores for Technical, Communication, Problem Solving, and Confidence.
2. Strengths: 3 key bullet points showcasing what the candidate did best.
3. Weaknesses: 2-3 specific technical or communication areas needing improvement.
4. Recommendations: 3 personalized study items or next-round preparation steps.
5. Hiring Recommendation: A final recommendation choice ("Hire", "Consider with Training", or "Do Not Hire") and a brief reasoning sentence.

Provide a timeline log mapping section transitions.
Structure the transcript as an array of speaker dialogs.

You MUST respond ONLY with a JSON object matching this TypeScript interface structure:
{
  "candidateSummary": {
    "overallScore": number,
    "technicalScore": number,
    "communicationScore": number,
    "problemSolvingScore": number,
    "confidenceScore": number,
    "duration": "e.g. 15:32"
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
    "status": "Clean" | "Flagged" | "Suspicious"
  }
}
`;
  }
};
