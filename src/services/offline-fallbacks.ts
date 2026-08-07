import type {
  InterviewContext,
  InterviewBlueprint,
  MCQQuestion,
  CodingQuestion,
  AptitudeQuestion,
  InterviewSession,
  OAReport,
  Project,
} from "@/src/types";

export function fallbackBlueprint(context: InterviewContext): InterviewBlueprint {
  const candidateName = context.resume?.name || "Candidate";
  const role = context.role || context.resume?.name || "Full Stack Developer";
  const skills =
    context.resume?.skills ||
    context.jd?.requiredSkills ||
    ["JavaScript", "TypeScript", "React", "Node.js"];
  const frameworks = context.jd?.preferredSkills || ["React", "Express", "Next.js"];
  const databases = ["MongoDB", "PostgreSQL"];
  const experienceLevel: InterviewBlueprint["experienceLevel"] =
    context.jd?.experience?.includes("5") || (context.resume?.skills?.length ?? 0) > 8
      ? "Mid"
      : "Junior";

  const projects: Project[] =
    context.resume?.projects?.map((p) => ({
      title: p.split("(")[0].trim(),
      description: p,
      technologies: skills.slice(0, 3),
    })) || [
      {
        title: "E-Commerce System",
        description: "A scaleable shopping platform built with React and Node.",
        technologies: ["React", "Node.js", "MongoDB"],
      },
    ];

  return {
    candidateName,
    source: context.source,
    role,
    experienceLevel,
    yearsOfExperience: experienceLevel === "Mid" ? 4 : 2,
    skills,
    frameworks,
    databases,
    projects,
    confidenceScore: 85,
    suggestedDifficulty: "Medium",
    estimatedCompanyLevel: "Product",
  };
}

export function fallbackMCQs(blueprint: InterviewBlueprint): MCQQuestion[] {
  const mockQuestions: MCQQuestion[] = [];
  const testSkills =
    blueprint.skills.length > 0 ? blueprint.skills : ["React", "JavaScript", "Node.js"];

  for (let i = 1; i <= 15; i++) {
    const skill = testSkills[(i - 1) % testSkills.length];
    mockQuestions.push({
      id: `mcq-${i}`,
      question: `Regarding ${skill}, which of the following statements is TRUE concerning memory management, design patterns, or optimal performance practices in production systems?`,
      options: [
        `Option A: ${skill} uses a single-threaded runtime model which prevents concurrent operations unless explicitly outsourced.`,
        `Option B: It is best practice to cache all intermediate operational results using optimized memory data structures.`,
        `Option C: Standard garbage collection sweeps are automatically triggered based on variable allocation thresholds.`,
        `Option D: Avoid placing state logic in functional bindings to maintain component purity and references.`,
      ],
      correctAnswer: `Option B: It is best practice to cache all operational results using optimized memory data structures.`,
      explanation: `In standard software design using ${skill}, caching intermediate states optimizes memory usage and prevents recalculation spikes.`,
      skill,
      difficulty: i % 3 === 0 ? "Hard" : i % 2 === 0 ? "Medium" : "Easy",
      expectedTime: 60,
    });
  }

  if (testSkills.includes("React") || testSkills.includes("JavaScript")) {
    mockQuestions[0] = {
      id: "mcq-1",
      question: "Which of the following is NOT a feature of React?",
      options: [
        "Virtual DOM",
        "Two-way data binding",
        "Component-based architecture",
        "JSX syntax",
      ],
      correctAnswer: "Two-way data binding",
      explanation:
        "React relies on one-way data binding. Frameworks like Angular support two-way data binding natively.",
      skill: "React",
      difficulty: "Easy",
      expectedTime: 45,
    };
  }

  return mockQuestions;
}

export function fallbackCodingQuestions(): CodingQuestion[] {
  return [
    {
      id: "cod-1",
      title: "Two Sum",
      difficulty: "Easy",
      problemStatement:
        "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
      constraints: [
        "2 <= nums.length <= 10^4",
        "-10^9 <= nums[i] <= 10^9",
        "-10^9 <= target <= 10^9",
      ],
      inputFormat: "First line contains target. Second line contains comma-separated array numbers.",
      outputFormat: "Two indices as comma-separated values, e.g. '0,1'.",
      examples: [
        {
          input: "9\n2,7,11,15",
          output: "0,1",
          explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
        },
      ],
      testCases: [
        { input: "9\n2,7,11,15", output: "0,1", isHidden: false },
        { input: "6\n3,2,4", output: "1,2", isHidden: false },
        { input: "6\n3,3", output: "0,1", isHidden: true },
        { input: "10\n1,5,5,9", output: "1,2", isHidden: true },
        { input: "8\n4,1,2,4", output: "0,3", isHidden: true },
      ],
      hints: [
        "Try using a hash map to look up targets in O(1) time.",
        "Ensure you don't use the same element index twice.",
      ],
    },
    {
      id: "cod-2",
      title: "Valid Parentheses",
      difficulty: "Easy",
      problemStatement:
        "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
      constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'"],
      inputFormat: "A single line containing the parenthesis string.",
      outputFormat: "true or false",
      examples: [
        { input: "()", output: "true" },
        { input: "()[]{}", output: "true" },
        { input: "(]", output: "false" },
      ],
      testCases: [
        { input: "()", output: "true", isHidden: false },
        { input: "()[]{}", output: "true", isHidden: false },
        { input: "(]", output: "false", isHidden: true },
        { input: "([)]", output: "false", isHidden: true },
        { input: "{[]}", output: "true", isHidden: true },
      ],
      hints: [
        "Use a stack to keep track of the opening brackets.",
        "When you see a closing bracket, check if it matches the top of the stack.",
      ],
    },
    {
      id: "cod-3",
      title: "Longest Substring Without Repeating Characters",
      difficulty: "Medium",
      problemStatement:
        "Given a string `s`, find the length of the longest substring without repeating characters.",
      constraints: [
        "0 <= s.length <= 5 * 10^4",
        "s consists of English letters, digits, symbols and spaces.",
      ],
      inputFormat: "A single line containing the string.",
      outputFormat: "An integer representing the length.",
      examples: [
        {
          input: "abcabcbb",
          output: "3",
          explanation: "The answer is 'abc', with the length of 3.",
        },
        {
          input: "bbbbb",
          output: "1",
          explanation: "The answer is 'b', with the length of 1.",
        },
      ],
      testCases: [
        { input: "abcabcbb", output: "3", isHidden: false },
        { input: "bbbbb", output: "1", isHidden: false },
        { input: "pwwkew", output: "3", isHidden: true },
        { input: "", output: "0", isHidden: true },
        { input: "dvdf", output: "3", isHidden: true },
      ],
      hints: [
        "Use a sliding window technique with two pointers.",
        "Keep track of the last seen index of each character using a hash map.",
      ],
    },
    {
      id: "cod-4",
      title: "Binary Tree Level Order Traversal",
      difficulty: "Medium",
      problemStatement:
        "Given the root of a binary tree represented as a flat comma-separated array of values (Breadth-First Search order, where 'null' represents missing child nodes), return the level order traversal of its nodes' values as a stringified list of levels.",
      constraints: [
        "The number of nodes in the tree is in the range [0, 2000].",
        "-1000 <= Node.val <= 1000",
      ],
      inputFormat: "Comma-separated representation of binary tree, e.g., '3,9,20,null,null,15,7'",
      outputFormat: "Stringified representation of levels, e.g., '[[3],[9,20],[15,7]]'",
      examples: [
        {
          input: "3,9,20,null,null,15,7",
          output: "[[3],[9,20],[15,7]]",
        },
      ],
      testCases: [
        { input: "3,9,20,null,null,15,7", output: "[[3],[9,20],[15,7]]", isHidden: false },
        { input: "1", output: "[[1]]", isHidden: false },
        { input: "", output: "[]", isHidden: true },
        { input: "1,2,null,3,null,4,null,5", output: "[[1],[2],[3],[4],[5]]", isHidden: true },
        { input: "1,2,3,4,null,null,5", output: "[[1],[2,3],[4,5]]", isHidden: true },
      ],
      hints: [
        "Use a queue to run a Breadth-First Search (BFS) level by level.",
        "Keep track of the number of nodes at each level during traversal.",
      ],
    },
    {
      id: "cod-5",
      title: "Merge k Sorted Lists",
      difficulty: "Hard",
      problemStatement:
        "You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.",
      constraints: [
        "k == lists.length",
        "0 <= k <= 10^4",
        "0 <= lists[i].length <= 500",
        "-10^4 <= lists[i][j] <= 10^4",
        "lists[i] is sorted in ascending order.",
      ],
      inputFormat:
        "Each list represented as a comma-separated line. Lists are separated by pipe (|) symbol.",
      outputFormat: "Comma-separated merged list.",
      examples: [
        {
          input: "1,4,5|1,3,4|2,6",
          output: "1,1,2,3,4,4,5,6",
        },
      ],
      testCases: [
        { input: "1,4,5|1,3,4|2,6", output: "1,1,2,3,4,4,5,6", isHidden: false },
        { input: "", output: "", isHidden: false },
        { input: "|", output: "", isHidden: true },
        { input: "2|1|3", output: "1,2,3", isHidden: true },
        { input: "1,8,9|2,7|3,4,5,6", output: "1,2,3,4,5,6,7,8,9", isHidden: true },
      ],
      hints: [
        "You can use a min-heap to keep track of the smallest node among all current lists.",
        "Alternatively, divide and conquer by repeatedly merging pairs of lists.",
      ],
    },
  ];
}

export function fallbackAptitudeQuestions(): AptitudeQuestion[] {
  return [
    {
      id: "apt-1",
      question:
        "A train 150 meters long is running at a speed of 54 km/hr. How much time will it take to cross a pole?",
      options: ["8 seconds", "9 seconds", "10 seconds", "12 seconds"],
      correctAnswer: "10 seconds",
      explanation:
        "Speed in m/s = 54 * (5/18) = 15 m/s. Time to cross pole = Length of train / Speed = 150 / 15 = 10 seconds.",
      category: "Numerical Ability",
      difficulty: "Easy",
    },
    {
      id: "apt-2",
      question: "Find the missing number in the series: 3, 7, 15, 31, 63, ...",
      options: ["95", "111", "127", "131"],
      correctAnswer: "127",
      explanation:
        "The pattern is: next number = (current number * 2) + 1. So, (63 * 2) + 1 = 126 + 1 = 127.",
      category: "Logical Reasoning",
      difficulty: "Easy",
    },
    {
      id: "apt-3",
      question:
        "A and B can complete a work together in 8 days. A alone can do it in 12 days. How long will B alone take to complete the work?",
      options: ["16 days", "18 days", "20 days", "24 days"],
      correctAnswer: "24 days",
      explanation:
        "Work rate of (A+B) = 1/8. Work rate of A = 1/12. Work rate of B = 1/8 - 1/12 = (3-2)/24 = 1/24. Thus, B alone takes 24 days.",
      category: "Numerical Ability",
      difficulty: "Medium",
    },
    {
      id: "apt-4",
      question:
        "Pointing to a photograph, a man said, 'I have no brother or sister, but that man's father is my father's son.' Whose photograph was it?",
      options: ["His father's", "His son's", "His own", "His nephew's"],
      correctAnswer: "His son's",
      explanation:
        "Since the man has no brother or sister, 'my father's son' is himself. So 'that man's father is myself'. Therefore, it is his son's photograph.",
      category: "Logical Reasoning",
      difficulty: "Medium",
    },
    {
      id: "apt-5",
      question: "Complete the analogy: LION : PRIDE :: WOLF : ?",
      options: ["PACK", "FLOCK", "HERD", "SWARM"],
      correctAnswer: "PACK",
      explanation: "A group of lions is called a Pride, and a group of wolves is called a Pack.",
      category: "Verbal Ability",
      difficulty: "Easy",
    },
    {
      id: "apt-6",
      question: "If SCOOTER is coded as TDNNSDQ, how is MOTORCYCLE coded?",
      options: ["NPSNSBXBKD", "NNUPQDXBKB", "NLSPQCYBKB", "NNSQPDBYKC"],
      correctAnswer: "NNUPQDXBKB",
      explanation:
        "The coding shifts alternating characters by +1 and -1. S+1=T, C-1=D, O-1=N, O+1=N, T-1=S, E+1=D, R-1=Q. Following motorcyle gives NNUPQDXBKB.",
      category: "Logical Reasoning",
      difficulty: "Hard",
    },
    {
      id: "apt-7",
      question:
        "A box contains 5 red, 8 blue, and 3 green marbles. If two marbles are drawn at random without replacement, what is the probability that both are red?",
      options: ["5/12", "1/12", "5/24", "7/24"],
      correctAnswer: "1/12",
      explanation:
        "Total marbles = 16. Red marbles = 5. Probability of first red = 5/16. Probability of second red = 4/15. Overall probability = (5/16) * (4/15) = 20/240 = 1/12.",
      category: "Numerical Ability",
      difficulty: "Hard",
    },
    {
      id: "apt-8",
      question: "Choose the word closest in meaning to 'OBDURATE'.",
      options: ["Stubborn", "Flexible", "Honest", "Mischievous"],
      correctAnswer: "Stubborn",
      explanation:
        "Obdurate means stubbornly refusing to change one's opinion or course of action.",
      category: "Verbal Ability",
      difficulty: "Medium",
    },
    {
      id: "apt-9",
      question:
        "Five people (P, Q, R, S, T) sit in a row. S is next to R, who sits on the extreme left. T is not next to S. Who sits next to T?",
      options: ["P only", "Q only", "P and Q", "S and P"],
      correctAnswer: "P and Q",
      explanation:
        "R sits at index 0. S sits next to R, so index 1. Sitting arrangement is R, S, P, T, Q or R, S, Q, T, P. In either case, T sits between P and Q, so next to P and Q.",
      category: "Analytical Reasoning",
      difficulty: "Hard",
    },
    {
      id: "apt-10",
      question: "Find the odd one out: 27, 64, 125, 144, 216",
      options: ["27", "64", "125", "144"],
      correctAnswer: "144",
      explanation:
        "27 is 3^3, 64 is 4^3, 125 is 5^3, 216 is 6^3. 144 is 12^2 (a square, not a cube).",
      category: "Analytical Reasoning",
      difficulty: "Easy",
    },
  ];
}

export function fallbackCodeEvaluation(testRunResults: {
  passed: number;
  total: number;
}): { complexity: string; codeQuality: string; optimization: string; suggestions: string } {
  const timeComplexity =
    testRunResults.passed === testRunResults.total
      ? "Time: O(N), Space: O(1)"
      : "Time: O(N^2), Space: O(1)";
  return {
    complexity: timeComplexity,
    codeQuality: "Code has basic formatting, matching standard logic structures.",
    optimization: "Review variable assignments and eliminate redundant nested loops.",
    suggestions:
      "- Add error boundary validation for input structures.\n- Use modern variable scoping (const/let).",
  };
}

export function fallbackOAReport(session: InterviewSession): OAReport {
  const evalData = session.evaluation!;
  return {
    candidateSummary: {
      name: session.blueprint.candidateName,
      role: session.blueprint.role,
      experience: `${session.blueprint.yearsOfExperience} Years (${session.blueprint.experienceLevel})`,
      difficulty: session.blueprint.suggestedDifficulty,
      duration: `${evalData.timeTaken} Mins`,
      overallScore: evalData.overallScore,
    },
    technicalPerformance: {
      "Problem Solving": evalData.codingScore,
      "Logical Aptitude": evalData.aptitudeScore,
      "Core Technical MCQs": evalData.mcqScore,
      "Code Complexity Analysis": Math.max(0, evalData.codingScore - 5),
    },
    codingPerformance: {
      problemsAttempted: evalData.codingStats.problemsAttempted,
      passed: evalData.codingStats.passed,
      failed: evalData.codingStats.failed,
      codeQuality:
        "Clear variable naming and modular decomposition of tasks. Standard code structures are maintained.",
      optimization:
        "Successfully avoided unnecessary runtime memory leaks. Big-O time complexity is close to optimal.",
      suggestions:
        "Consider adding explicit null boundary checks and practicing advanced graph algorithms.",
    },
    aptitudePerformance: {
      logical: Math.round(evalData.aptitudeScore * 1.0),
      numerical: Math.round(evalData.aptitudeScore * 0.9),
      verbal: Math.round(evalData.aptitudeScore * 1.1),
      analytical: Math.round(evalData.aptitudeScore * 0.95),
    },
    strongAreas: session.blueprint.skills.slice(0, 3).concat(["Logical Deduction"]),
    weakAreas: ["Dynamic Programming Optimization", "Permutations Probability Calculations"],
    personalizedLearningPath: [
      "Study optimal sub-structures and practice DP problems (Knapsack, LCS) on LeetCode.",
      "Strengthen probability distributions and permutations mathematics.",
      "Learn memory profiling in Chrome DevTools to analyze performance bottlenecks.",
    ],
    interviewReadiness:
      session.blueprint.experienceLevel === "Mid"
        ? "Ready for Mid-Level Roles"
        : "Ready for Junior Roles",
    finalRecommendation: evalData.passed ? "Proceed to AI Interview" : "Retry OA Assessment",
  };
}
