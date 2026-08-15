"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  FileText,
  User,
  Briefcase,
  Code2,
  ChevronRight,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Check,
  Plus,
  Sparkles,
  ArrowRight,
  Database,
  Server,
  Layout,
  Terminal,
  Cpu,
  BarChart3,
  GitBranch,
  FileCode2,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DropZone } from "../JDUpload/DropZone";
import { parseJobDescription, parseResume } from "@/src/lib/contextParser";
import type { InterviewContext, InterviewType } from "@/src/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface InterviewConfigurationProps {
  interviewType: InterviewType;
  onConfigurationComplete?: () => void;
}

const ROLES_LIST = [
  { id: "mern", name: "MERN Stack Developer", icon: Code2 },
  { id: "frontend", name: "Frontend Developer", icon: Layout },
  { id: "backend", name: "Backend Developer", icon: Server },
  { id: "fullstack", name: "Full Stack Developer", icon: Cpu },
  { id: "java", name: "Java Developer", icon: Terminal },
  { id: "python", name: "Python Developer", icon: FileCode2 },
  { id: "data", name: "Data Analyst", icon: BarChart3 },
  { id: "devops", name: "DevOps Engineer", icon: GitBranch },
];

const STAGES = [
  { index: 0, label: "Select Source" },
  { index: 1, label: "Provide Details" },
  { index: 2, label: "Review Context" },
  { index: 3, label: "Completed" },
];

export function InterviewConfiguration({ interviewType, onConfigurationComplete }: InterviewConfigurationProps) {
  const [step, setStep] = useState<"select-method" | "upload" | "role-select" | "parsing" | "preview" | "saved">("select-method");
  const [source, setSource] = useState<"jd" | "resume" | "role" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [context, setContext] = useState<InterviewContext | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [prefSkillDialogOpen, setPrefSkillDialogOpen] = useState(false);
  const [newPrefSkill, setNewPrefSkill] = useState("");
  const [candSkillDialogOpen, setCandSkillDialogOpen] = useState(false);
  const [newCandSkill, setNewCandSkill] = useState("");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState("");

  // Parsing progress steps simulation
  const [parsingStep, setParsingStep] = useState(0);
  const parsingMessages = [
    "Reading PDF content...",
    "Identifying key sections...",
    "Extracting skills, projects, and metadata...",
    "Formatting structured context..."
  ];

  // Load context from local storage if existing on mount
  useEffect(() => {
    const saved = localStorage.getItem(`interview_context_${interviewType}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as InterviewContext;
        setContext(parsed);
        setSource(parsed.source);
        if (parsed.source === "role") {
          setSelectedRole(parsed.role || null);
        }
        setStep("preview");
      } catch (e) {
        console.error("Failed to load existing context", e);
      }
    }
  }, [interviewType]);

  const handleSourceSelect = (selectedSource: "jd" | "resume" | "role") => {
    setSource(selectedSource);
    if (selectedSource === "role") {
      setStep("role-select");
    } else {
      setStep("upload");
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      toast.error("Please upload a PDF file only.");
      return;
    }
    setFile(selectedFile);
    setStep("parsing");
    setParsingStep(0);

    // Simulate parsing progress
    const interval = setInterval(() => {
      setParsingStep((prev) => {
        if (prev >= parsingMessages.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 850);

    try {
      let parsedData: InterviewContext;
      if (source === "jd") {
        parsedData = await parseJobDescription(selectedFile);
      } else {
        parsedData = await parseResume(selectedFile);
      }

      clearInterval(interval);
      setContext(parsedData);
      setStep("preview");
      toast.success(
        source === "jd"
          ? "Job Description parsed successfully!"
          : `Resume parsed! Extracted profile for ${parsedData.resume?.name || "Candidate"}`
      );
    } catch (err: any) {
      clearInterval(interval);
      setStep("upload");
      toast.error(err.message || "Failed to parse the PDF document.");
    }
  };

  const handleRoleSelect = (roleName: string) => {
    setSelectedRole(roleName);
    const parsedData: InterviewContext = {
      source: "role",
      role: roleName,
    };
    setContext(parsedData);
    setStep("preview");
    toast.success(`Selected role: ${roleName}`);
  };

  const handleSave = () => {
    if (!context) return;
    localStorage.setItem(`interview_context_${interviewType}`, JSON.stringify(context));
    setStep("saved");
    toast.success("Interview configuration saved successfully!");
  };

  const handleGoToTest = () => {
    if (onConfigurationComplete) {
      onConfigurationComplete();
    } else {
      window.location.reload();
    }
  };

  const handleReset = () => {
    setStep("select-method");
    setSource(null);
    setFile(null);
    setSelectedRole(null);
    setContext(null);
  };

  // Editable fields handlers on preview screen
  const updateContextField = (updater: (prev: InterviewContext) => InterviewContext) => {
    if (!context) return;
    const next = updater(context);
    setContext(next);
  };

  const getCurrentStageIndex = () => {
    switch (step) {
      case "select-method":
        return 0;
      case "upload":
      case "role-select":
        return 1;
      case "parsing":
      case "preview":
        return 2;
      case "saved":
        return 3;
      default:
        return 0;
    }
  };

  const currentStage = getCurrentStageIndex();

  return (
    <div className=" mx-auto space-y-6">
      {/* Interactive Progress Stepper */}
      {step !== "select-method" && (
        <div className=" p-4 md:p-6 animate-in fade-in duration-200">
          <div className="flex items-center flex-col md:flex-row md:items-center justify-between gap-6">


            {/* Stepper Steps */}
            <div className="flex  items-center flex-1 max-w-xl md:justify-end">
              <div className="relative flex items-center justify-between w-full pb-6">
                {/* Connecting background line */}
                <div className="absolute left-4 right-4 top-4 -translate-y-1/2 h-[2px] bg-[#ECECEC] z-0" />

                {/* Connecting active/progress line */}
                <div
                  className="absolute left-4 top-4 -translate-y-1/2 h-[2px] bg-blue-500 transition-all duration-300 z-0"
                  style={{
                    width: `calc(${(currentStage / 3) * 100}% - 8px)`
                  }}
                />

                {STAGES.map((stage, idx) => {
                  const isActive = currentStage === idx;
                  const isCompleted = currentStage > idx;

                  // Validation to determine clickability
                  let isClickable = false;
                  if (step !== "parsing") {
                    if (idx === 0) isClickable = true;
                    if (idx === 1 && source !== null) isClickable = true;
                    if (idx === 2 && context !== null) isClickable = true;
                    if (idx === 3 && step === "saved") isClickable = true;
                  }

                  const handleNav = () => {
                    if (!isClickable) return;
                    if (idx === 0) {
                      setStep("select-method");
                    } else if (idx === 1) {
                      if (source === "role") {
                        setStep("role-select");
                      } else {
                        setStep("upload");
                      }
                    } else if (idx === 2) {
                      setStep("preview");
                    } else if (idx === 3) {
                      setStep("saved");
                    }
                  };

                  return (
                    <button
                      key={stage.index}
                      onClick={handleNav}
                      disabled={!isClickable}
                      className="relative flex flex-col items-center group focus:outline-none z-10 disabled:cursor-not-allowed"
                    >
                      {/* Circle Indicator */}
                      <div
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center border text-xs font-semibold transition-all duration-200 bg-white",
                          isCompleted
                            ? "border-blue-500 bg-blue-500 text-white"
                            : isActive
                              ? "border-blue-500 text-blue-500 ring-4 ring-blue-50"
                              : "border-[#ECECEC] text-[#9CA3AF]",
                          isClickable && !isActive && !isCompleted && "hover:border-[#9CA3AF] hover:text-[#6B7280] cursor-pointer",
                          isClickable && isCompleted && "hover:bg-blue-600 hover:border-blue-600 cursor-pointer"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text">{idx + 1}</span>
                        )}
                      </div>

                      {/* Text Label */}
                      <span
                        className={cn(
                          "absolute top-15 left-1/2 -translate-x-1/2 text-[9px] sm:text-[11px] font-medium text-center leading-tight whitespace-normal w-[65px] sm:w-[90px] transition-colors duration-200",
                          isActive
                            ? "text-[#111111] font-semibold"
                            : isClickable
                              ? "text-[#6B7280] group-hover:text-[#111111]"
                              : "text-[#9CA3AF]"
                        )}
                      >
                        {stage.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Select Context Method */}
      {step === "select-method" && (
        <div className="space-y-6  animate-in fade-in duration-200">


          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleSourceSelect("jd")}
              className="flex flex-col items-start text-left bg-white rounded-lg border border-[#ECECEC] p-6  transition-all duration-150 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-lg bg-blue-50/80 flex items-center justify-center mb-5">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-[14px] font-medium text-[#111111]">Upload Job Description</h3>
              <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
                Provide a JD PDF to practice questions tailored to a specific role posting.
              </p>
              <span className="flex items-center gap-0.5 text-xs font-medium text-blue-500 mt-5 group-hover:translate-x-0.5 transition-transform duration-150">
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              onClick={() => handleSourceSelect("resume")}
              className="flex flex-col items-start text-left bg-white rounded-lg border border-[#ECECEC] p-6 transition-all duration-150 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-lg bg-blue-50/80 flex items-center justify-center mb-5">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-[14px] font-medium text-[#111111]">Upload Resume</h3>
              <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
                Use your Resume PDF to practice questions targeted at your professional experience.
              </p>
              <span className="flex items-center gap-0.5 text-xs font-medium text-blue-500 mt-5 group-hover:translate-x-0.5 transition-transform duration-150">
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              onClick={() => handleSourceSelect("role")}
              className="flex flex-col items-start text-left bg-white rounded-lg border border-[#ECECEC] p-6  transition-all duration-150 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-lg bg-blue-50/80 flex items-center justify-center mb-5">
                <Code2 className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-[14px] font-medium text-[#111111]">Choose Target Role</h3>
              <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
                No files? Pick from standard engineering roles to practice typical questions.
              </p>
              <span className="flex items-center gap-0.5 text-xs font-medium text-blue-500 mt-5 group-hover:translate-x-0.5 transition-transform duration-150">
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step 2a: Upload Screen */}
      {step === "upload" && source && (
        <div className="w-full flex items-center justify-center">

          <div className="bg-white w-[700px] rounded-lg border border-[#ECECEC] p-6 space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-blue-50/80 flex items-center justify-center">
                {source === "jd" ? (
                  <Briefcase className="w-5 h-5 text-blue-400" />
                ) : (
                  <User className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-medium text-[#111111]">
                  Upload {source === "jd" ? "Job Description" : "Resume"} PDF
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Upload your document to generate structured mock context.
                </p>
              </div>
            </div>

            <DropZone onFileSelect={handleFileSelect} />
          </div>
        </div>

      )}

      {/* Step 2b: Role Selection Screen */}
      {step === "role-select" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="text-center py-2">
            <h3 className="text-[15px] font-medium text-[#111111]">Select Target Role</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Choose one of the standard roles below to customize the interview scope.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {ROLES_LIST.map((roleItem) => {
              const Icon = roleItem.icon;
              const isSelected = selectedRole === roleItem.name;

              return (
                <button
                  key={roleItem.id}
                  onClick={() => handleRoleSelect(roleItem.name)}
                  className={cn(
                    "flex flex-col items-center justify-center p-5 rounded-lg border text-center transition-all duration-150 cursor-pointer",
                    isSelected
                      ? "border-blue-500 bg-blue-50/20 text-[#111111]"
                      : "border-[#ECECEC] bg-white text-[#6B7280] hover:border-[#D4D4D4] hover:bg-[#F7F7F7]/30 hover:text-[#111111]"
                  )}
                >
                  <Icon className={cn("w-5 h-5 mb-3", isSelected ? "text-blue-500" : "text-[#9CA3AF]")} />
                  <span className="text-xs font-medium">{roleItem.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Parsing Animation Screen */}
      {step === "parsing" && (
        <div className="bg-white rounded-lg border border-[#ECECEC] p-10 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-200">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center animate-pulse">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-400 animate-spin" style={{ animationDuration: "12s" }} />
          </div>

          <div className="space-y-2">
            <h4 className="text-[14px] font-semibold text-[#111111]">Analyzing Context Document</h4>
            <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto">
              Our simulated parsing AI is structuring candidate profile data.
            </p>
          </div>

          {/* Step-by-Step progress messages */}
          <div className="w-full max-w-xs bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-4 text-left">
            <ul className="space-y-2.5">
              {parsingMessages.map((msg, index) => {
                const isCurrent = parsingStep === index;
                const isDone = parsingStep > index;

                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center gap-2.5 text-xs transition-opacity duration-150",
                      isCurrent ? "text-blue-500 font-medium opacity-100" : isDone ? "text-green-600 opacity-90" : "text-[#9CA3AF] opacity-50"
                    )}
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isCurrent ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <span>{msg}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Step 4: Preview/Edit Screen */}
      {step === "preview" && context && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
            <div>
              <h3 className="text-[16px] font-medium text-[#111111]">Review Your Interview Context</h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Verify the parsed details before final confirmation.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:text-[#111111] bg-white border border-[#ECECEC] rounded-lg hover:border-[#D4D4D4] transition-all duration-150 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Configure New
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Context Source Metadata Card */}
            <div className="bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center">
                  {context.source === "jd" && <Briefcase className="w-5 h-5 text-blue-500" />}
                  {context.source === "resume" && <User className="w-5 h-5 text-blue-500" />}
                  {context.source === "role" && <Code2 className="w-5 h-5 text-blue-500" />}
                </div>
                <div>
                  <p className="text-[12px] text-[#9CA3AF]">Context Source</p>
                  <p className="text-[14px] font-medium text-[#111111] capitalize">
                    {context.source === "jd" ? "Job Description PDF" : context.source === "resume" ? "Resume PDF" : "Chosen Target Role"}
                  </p>
                </div>
              </div>
              {file && (
                <span className="text-xs text-[#9CA3AF] truncate max-w-[200px]">
                  {file.name}
                </span>
              )}
            </div>

            {/* Displaying JD details if JD is source */}
            {context.source === "jd" && context.jd && (
              <div className="bg-white rounded-lg border border-[#ECECEC] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#ECECEC] bg-gray-50/50">
                  <h4 className="text-sm font-medium text-[#111111] ">Job Description Metadata</h4>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-[#9CA3AF] block">Job Role</span>
                      <input
                        type="text"
                        value={context.role || ""}
                        onChange={(e) => updateContextField((prev) => ({ ...prev, role: e.target.value }))}
                        className="text-[13px] font-medium text-[#111111] bg-transparent border-b border-transparent hover:border-[#ECECEC] focus:border-blue-500 focus:outline-none w-full py-0.5 mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-[#9CA3AF] block">Company Name</span>
                      <input
                        type="text"
                        value={context.jd.company || ""}
                        onChange={(e) => updateContextField((prev) => ({
                          ...prev,
                          jd: { ...prev.jd!, company: e.target.value }
                        }))}
                        className="text-[13px] font-medium text-[#111111] bg-transparent border-b border-transparent hover:border-[#ECECEC] focus:border-blue-500 focus:outline-none w-full py-0.5 mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-[#9CA3AF] block">Experience Required</span>
                      <input
                        type="text"
                        value={context.jd.experience || ""}
                        onChange={(e) => updateContextField((prev) => ({
                          ...prev,
                          jd: { ...prev.jd!, experience: e.target.value }
                        }))}
                        className="text-[13px] font-medium text-[#111111] bg-transparent border-b border-transparent hover:border-[#ECECEC] focus:border-blue-500 focus:outline-none w-full py-0.5 mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="border-t border-[#ECECEC] pt-4 space-y-3">
                    <div>
                      <span className="text-xs text-[#6B7280] font-medium block mb-2">Required Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {context.jd.requiredSkills.map((skill, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-[#F3F4F6] text-[#111111] text-xs font-normal px-2 py-0.5 rounded-full border border-[#ECECEC]">
                            <span>{skill}</span>
                            <button
                              onClick={() => {
                                updateContextField((prev) => ({
                                  ...prev,
                                  jd: {
                                    ...prev.jd!,
                                    requiredSkills: prev.jd!.requiredSkills.filter((_, i) => i !== idx)
                                  }
                                }));
                              }}
                              className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
                          <DialogTrigger className="flex items-center gap-1 text-xs text-blue-500 font-medium px-2.5 py-0.5 rounded-full border border-dashed border-blue-200 hover:border-blue-300 transition-colors cursor-pointer">
                            <Plus className="w-3 h-3" />
                            Add
                          </DialogTrigger>

                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Add Required Skill</DialogTitle>
                              <DialogDescription>
                                Enter a skill you want to include in the required skills list.
                              </DialogDescription>
                            </DialogHeader>

                            <Input
                              placeholder="e.g. TypeScript"
                              value={newSkill}
                              onChange={(e) => setNewSkill(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newSkill.trim()) {
                                  e.preventDefault();
                                  updateContextField((prev) => ({
                                    ...prev,
                                    jd: {
                                      ...prev.jd!,
                                      requiredSkills: [
                                        ...prev.jd!.requiredSkills,
                                        newSkill.trim(),
                                      ],
                                    },
                                  }));
                                  setNewSkill("");
                                  setSkillDialogOpen(false);
                                }
                              }}
                              autoFocus
                            />

                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setNewSkill("");
                                  setSkillDialogOpen(false);
                                }}
                              >
                                Cancel
                              </Button>

                              <Button
                                type="button"
                                onClick={() => {
                                  if (!newSkill.trim()) return;

                                  updateContextField((prev) => ({
                                    ...prev,
                                    jd: {
                                      ...prev.jd!,
                                      requiredSkills: [
                                        ...prev.jd!.requiredSkills,
                                        newSkill.trim(),
                                      ],
                                    },
                                  }));

                                  setNewSkill("");
                                  setSkillDialogOpen(false);
                                }}
                              >
                                Add Skill
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-xs text-[#6B7280] font-medium block mb-2">Preferred Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {context.jd.preferredSkills.map((skill, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-[#F9FAFB] text-[#6B7280] text-xs font-normal px-2 py-0.5 rounded-full border border-[#ECECEC]">
                            <span>{skill}</span>
                            <button
                              onClick={() => {
                                updateContextField((prev) => ({
                                  ...prev,
                                  jd: {
                                    ...prev.jd!,
                                    preferredSkills: prev.jd!.preferredSkills.filter((_, i) => i !== idx)
                                  }
                                }));
                              }}
                              className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <Dialog open={prefSkillDialogOpen} onOpenChange={setPrefSkillDialogOpen}>
                          <DialogTrigger className="flex items-center gap-0.5 text-xs text-blue-500 font-medium px-2.5 py-0.5 rounded-full border border-dashed border-blue-200 hover:border-blue-300 transition-colors cursor-pointer">
                            <Plus className="w-3 h-3" /> Add
                          </DialogTrigger>

                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Add Preferred Skill</DialogTitle>
                              <DialogDescription>
                                Enter an optional or preferred skill.
                              </DialogDescription>
                            </DialogHeader>

                            <Input
                              placeholder="e.g. Docker, GraphQL"
                              value={newPrefSkill}
                              onChange={(e) => setNewPrefSkill(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newPrefSkill.trim()) {
                                  e.preventDefault();
                                  updateContextField((prev) => ({
                                    ...prev,
                                    jd: {
                                      ...prev.jd!,
                                      preferredSkills: [...prev.jd!.preferredSkills, newPrefSkill.trim()]
                                    }
                                  }));
                                  setNewPrefSkill("");
                                  setPrefSkillDialogOpen(false);
                                }
                              }}
                              autoFocus
                            />

                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setNewPrefSkill("");
                                  setPrefSkillDialogOpen(false);
                                }}
                              >
                                Cancel
                              </Button>

                              <Button
                                type="button"
                                onClick={() => {
                                  if (!newPrefSkill.trim()) return;

                                  updateContextField((prev) => ({
                                    ...prev,
                                    jd: {
                                      ...prev.jd!,
                                      preferredSkills: [...prev.jd!.preferredSkills, newPrefSkill.trim()]
                                    }
                                  }));

                                  setNewPrefSkill("");
                                  setPrefSkillDialogOpen(false);
                                }}
                              >
                                Add Skill
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Displaying Resume details if Resume is source */}
            {context.source === "resume" && context.resume && (
              <div className="bg-white rounded-lg border border-[#ECECEC] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#ECECEC] bg-gray-50/50">
                  <h4 className="text-xs font-medium text-[#111111] uppercase tracking-wider">Candidate Profile Metadata</h4>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-[#9CA3AF] block">Candidate Name</span>
                      <input
                        type="text"
                        value={context.resume.name || ""}
                        onChange={(e) => updateContextField((prev) => ({
                          ...prev,
                          resume: { ...prev.resume!, name: e.target.value }
                        }))}
                        className="text-[13px] font-medium text-[#111111] bg-transparent border-b border-transparent hover:border-[#ECECEC] focus:border-blue-500 focus:outline-none w-full py-0.5 mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-[#9CA3AF] block">Education</span>
                      <input
                        type="text"
                        value={context.resume.education || ""}
                        onChange={(e) => updateContextField((prev) => ({
                          ...prev,
                          resume: { ...prev.resume!, education: e.target.value }
                        }))}
                        className="text-[13px] font-medium text-[#111111] bg-transparent border-b border-transparent hover:border-[#ECECEC] focus:border-blue-500 focus:outline-none w-full py-0.5 mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="border-t border-[#ECECEC] pt-4 space-y-4">
                    <div>
                      <span className="text-xs text-[#6B7280] font-medium block mb-2">Extracted Candidate Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {context.resume.skills.map((skill, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-[#F3F4F6] text-[#111111] text-xs font-normal px-2 py-0.5 rounded-full border border-[#ECECEC]">
                            <span>{skill}</span>
                            <button
                              onClick={() => {
                                updateContextField((prev) => ({
                                  ...prev,
                                  resume: {
                                    ...prev.resume!,
                                    skills: prev.resume!.skills.filter((_, i) => i !== idx)
                                  }
                                }));
                              }}
                              className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <Dialog open={candSkillDialogOpen} onOpenChange={setCandSkillDialogOpen}>
                          <DialogTrigger className="flex items-center gap-0.5 text-xs text-blue-500 font-medium px-2.5 py-0.5 rounded-full border border-dashed border-blue-200 hover:border-blue-300 transition-colors cursor-pointer">
                            <Plus className="w-3 h-3" /> Add
                          </DialogTrigger>

                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Add Candidate Skill</DialogTitle>
                              <DialogDescription>
                                Enter a skill from your experience or resume.
                              </DialogDescription>
                            </DialogHeader>

                            <Input
                              placeholder="e.g. React, Node.js, Python"
                              value={newCandSkill}
                              onChange={(e) => setNewCandSkill(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newCandSkill.trim()) {
                                  e.preventDefault();
                                  updateContextField((prev) => ({
                                    ...prev,
                                    resume: {
                                      ...prev.resume!,
                                      skills: [...prev.resume!.skills, newCandSkill.trim()]
                                    }
                                  }));
                                  setNewCandSkill("");
                                  setCandSkillDialogOpen(false);
                                }
                              }}
                              autoFocus
                            />

                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setNewCandSkill("");
                                  setCandSkillDialogOpen(false);
                                }}
                              >
                                Cancel
                              </Button>

                              <Button
                                type="button"
                                onClick={() => {
                                  if (!newCandSkill.trim()) return;

                                  updateContextField((prev) => ({
                                    ...prev,
                                    resume: {
                                      ...prev.resume!,
                                      skills: [...prev.resume!.skills, newCandSkill.trim()]
                                    }
                                  }));

                                  setNewCandSkill("");
                                  setCandSkillDialogOpen(false);
                                }}
                              >
                                Add Skill
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="border-t border-[#ECECEC] pt-4">
                      <span className="text-xs text-[#6B7280] font-medium block mb-3">Key Projects / Experiences</span>
                      <div className="space-y-2">
                        {context.resume.projects.map((proj, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg border border-[#ECECEC] text-xs">
                            <span className="font-medium text-[#111111]">{proj}</span>
                            <button
                              onClick={() => {
                                updateContextField((prev) => ({
                                  ...prev,
                                  resume: {
                                    ...prev.resume!,
                                    projects: prev.resume!.projects.filter((_, i) => i !== idx)
                                  }
                                }));
                              }}
                              className="text-[#9CA3AF] hover:text-red-500 transition-colors p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                          <DialogTrigger className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-[#ECECEC] hover:border-[#D4D4D4] rounded-lg text-xs font-medium text-blue-500 bg-[#F9FAFB]/50 hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                            <Plus className="w-3.5 h-3.5" /> Add Project
                          </DialogTrigger>

                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Add Key Project / Experience</DialogTitle>
                              <DialogDescription>
                                Describe a project or experience you want to highlight.
                              </DialogDescription>
                            </DialogHeader>

                            <Input
                              placeholder="e.g. Built an AI-powered code evaluator with real-time feedback"
                              value={newProject}
                              onChange={(e) => setNewProject(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newProject.trim()) {
                                  e.preventDefault();
                                  updateContextField((prev) => ({
                                    ...prev,
                                    resume: {
                                      ...prev.resume!,
                                      projects: [...prev.resume!.projects, newProject.trim()]
                                    }
                                  }));
                                  setNewProject("");
                                  setProjectDialogOpen(false);
                                }
                              }}
                              autoFocus
                            />

                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setNewProject("");
                                  setProjectDialogOpen(false);
                                }}
                              >
                                Cancel
                              </Button>

                              <Button
                                type="button"
                                onClick={() => {
                                  if (!newProject.trim()) return;

                                  updateContextField((prev) => ({
                                    ...prev,
                                    resume: {
                                      ...prev.resume!,
                                      projects: [...prev.resume!.projects, newProject.trim()]
                                    }
                                  }));

                                  setNewProject("");
                                  setProjectDialogOpen(false);
                                }}
                              >
                                Add Project
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Displaying selected target role */}
            {context.source === "role" && (
              <div className="bg-white rounded-lg border border-[#ECECEC] p-5">
                <span className="text-xs text-[#9CA3AF]">Target Interview Role</span>
                <p className="text-[15px] font-semibold text-[#111111] mt-1">{context.role}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-700 text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <span>Save Context</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Saved / Confirmation screen */}
      {step === "saved" && (
        <div className="bg-white rounded-lg border border-[#ECECEC] p-8 text-center space-y-6 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>

          <div className="space-y-2">
            <h3 className="text-[15px] font-semibold text-[#111111]">Interview Context Saved!</h3>
            <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto leading-relaxed">
              Your context target role details have been saved for this practice mode.
            </p>
          </div>

          {context && (
            <div className="max-w-md mx-auto bg-[#F9FAFB] rounded-lg border border-[#ECECEC] p-4 text-left space-y-2">
              <div className="flex justify-between text-xs border-b border-[#ECECEC] pb-2">
                <span className="text-[#9CA3AF]">Configuration Source</span>
                <span className="font-medium text-[#111111] capitalize">{context.source}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#9CA3AF]">Role Configured</span>
                <span className="font-medium text-[#111111]">{context.role || context.resume?.name || "Standard Target"}</span>
              </div>
            </div>
          )}

          {/* Take Me to Test CTA */}
          <button
            onClick={handleGoToTest}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold rounded-xl flex items-center gap-2.5 mx-auto transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer group"
          >
            Take Me to Test
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="pt-3 border-t border-[#ECECEC] flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setStep("preview")}
              className="px-4 py-1.5 border border-[#ECECEC] hover:border-[#D4D4D4] bg-white text-[13px] font-medium rounded-lg text-[#6B7280] hover:text-[#111111] transition-all duration-150 cursor-pointer"
            >
              View Settings
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-1.5 border border-transparent bg-blue-50 hover:bg-blue-100 text-[13px] font-medium rounded-lg text-blue-600 transition-all duration-150 cursor-pointer"
            >
              Reset Context
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
