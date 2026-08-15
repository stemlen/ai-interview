/**
 * Comprehensive technical skills dictionary and alias mapping.
 * Used for heuristic regex extraction and skill normalization.
 */

export const SKILL_TAXONOMY: Record<string, string[]> = {
  // Programming Languages
  languages: [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "C", "Go", "Golang",
    "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Scala", "R", "SQL", "HTML",
    "HTML5", "CSS", "CSS3", "Sass", "SCSS", "Bash", "Shell", "PowerShell", "Solidity"
  ],

  // Frontend Frameworks & Libraries
  frontend: [
    "React", "React.js", "Next.js", "Vue", "Vue.js", "Nuxt.js", "Angular", "Svelte",
    "SvelteKit", "Tailwind CSS", "Bootstrap", "Material-UI", "MUI", "Chakra UI",
    "Shadcn UI", "Redux", "Redux Toolkit", "Zustand", "MobX", "Recoil", "React Query",
    "TanStack Query", "GraphQL", "Apollo Client", "Webpack", "Vite", "Turbopack",
    "Framer Motion", "Three.js", "D3.js", "Chart.js", "WebSockets"
  ],

  // Backend Frameworks & Runtimes
  backend: [
    "Node.js", "Express", "Express.js", "NestJS", "Fastify", "Koa", "Django", "Flask",
    "FastAPI", "Spring", "Spring Boot", "ASP.NET", ".NET Core", "Ruby on Rails",
    "Laravel", "Gin", "Echo", "Fiber", "gRPC", "REST API", "RESTful APIs",
    "GraphQL", "Microservices", "Serverless", "Socket.io", "Kafka", "RabbitMQ", "Celery"
  ],

  // Databases & ORMs
  databases: [
    "PostgreSQL", "Postgres", "MySQL", "MongoDB", "Redis", "SQLite", "MariaDB",
    "Oracle", "Microsoft SQL Server", "MSSQL", "Cassandra", "DynamoDB", "Firebase",
    "Firestore", "Supabase", "Appwrite", "Prisma", "TypeORM", "Drizzle ORM",
    "Mongoose", "Hibernate", "Elasticsearch", "Neo4j", "Vector DB", "Pinecone", "Milvus"
  ],

  // Cloud & DevOps
  devops: [
    "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud Platform", "Docker",
    "Kubernetes", "K8s", "Terraform", "Ansible", "Jenkins", "GitHub Actions",
    "GitLab CI", "CircleCI", "CI/CD", "Helm", "Prometheus", "Grafana", "Nginx",
    "Apache", "Cloudflare", "Vercel", "Netlify", "Linux", "Ubuntu", "Debian"
  ],

  // AI / ML & Data
  ai_ml: [
    "Machine Learning", "Deep Learning", "Artificial Intelligence", "NLP",
    "Computer Vision", "TensorFlow", "PyTorch", "Keras", "Scikit-Learn", "OpenCV",
    "Pandas", "NumPy", "LangChain", "LlamaIndex", "Hugging Face", "LLMs", "RAG",
    "OpenAI API", "Gemini API", "Ollama", "Data Analysis", "Data Science", "Tableau", "Power BI"
  ],

  // Mobile
  mobile: [
    "React Native", "Flutter", "iOS", "Android", "SwiftUI", "Jetpack Compose",
    "Expo", "Capacitor", "Cordova"
  ],

  // Testing & Quality
  testing: [
    "Jest", "Vitest", "Cypress", "Playwright", "Mocha", "Chai", "Selenium",
    "JUnit", "PyTest", "Postman", "Swagger", "TDD", "BDD"
  ],

  // Architecture & Concepts
  concepts: [
    "Data Structures", "Algorithms", "System Design", "Object-Oriented Programming",
    "OOP", "Design Patterns", "Clean Architecture", "Agile", "Scrum", "Git",
    "GitHub", "GitLab", "Bitbucket", "Jira", "OAuth", "JWT", "Web Security", "SEO"
  ]
};

// Flattened list of canonical skills for fast matching
export const ALL_CANONICAL_SKILLS: string[] = Object.values(SKILL_TAXONOMY).flat();

// Alias dictionary to normalize varied representations
export const SKILL_ALIASES: Record<string, string> = {
  "js": "JavaScript",
  "ts": "TypeScript",
  "py": "Python",
  "golang": "Go",
  "reactjs": "React",
  "react.js": "React",
  "nextjs": "Next.js",
  "next.js": "Next.js",
  "vuejs": "Vue",
  "vue.js": "Vue",
  "nuxtjs": "Nuxt.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "expressjs": "Express",
  "express.js": "Express",
  "nest": "NestJS",
  "nestjs": "NestJS",
  "tailwind": "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "mongo": "MongoDB",
  "mongodb": "MongoDB",
  "k8s": "Kubernetes",
  "docker": "Docker",
  "aws": "AWS",
  "gcp": "GCP",
  "azure": "Azure",
  "graphql": "GraphQL",
  "rest": "REST APIs",
  "restful": "REST APIs",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  "prisma": "Prisma",
  "drizzle": "Drizzle ORM",
  "appwrite": "Appwrite",
  "supabase": "Supabase",
  "firebase": "Firebase",
  "redux": "Redux",
  "zustand": "Zustand",
  "spring": "Spring Boot",
  "springboot": "Spring Boot",
  "fastapi": "FastAPI",
  "django": "Django",
  "flask": "Flask",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "github actions": "GitHub Actions",
  "git": "Git",
  "github": "GitHub",
  "linux": "Linux",
  "langchain": "LangChain",
  "rag": "RAG",
  "llm": "LLMs",
  "llms": "LLMs"
};

/**
 * Normalizes a raw skill string to its canonical display form if recognized.
 */
export function normalizeSkill(raw: string): string {
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  
  if (SKILL_ALIASES[lower]) {
    return SKILL_ALIASES[lower];
  }

  // Exact case-insensitive match against canonical dictionary
  const matched = ALL_CANONICAL_SKILLS.find(
    s => s.toLowerCase() === lower
  );

  return matched || clean;
}
