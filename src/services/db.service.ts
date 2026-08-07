import type {
  InterviewSession,
  AIInterviewSession,
  AudioInterviewSession,
  FullInterviewSession,
} from "@/src/types";
import { Client, Databases, Query } from "appwrite";
import { APPWRITE_CONFIG } from "@/src/constants";

/**
 * Session persistence:
 * - Primary: Appwrite collections
 * - Local fallback: in-memory maps only (same Node process)
 *
 * `src/data/db.json` is NOT used for sessions. It only stores static
 * fallback question banks for when GPT generation fails / times out.
 */

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

const databases = new Databases(appwriteClient);
const databaseId = APPWRITE_CONFIG.databaseId;

const oaCollectionId = APPWRITE_CONFIG.oaCollectionId;
const aiCollectionId = APPWRITE_CONFIG.aiCollectionId;
const audioCollectionId = APPWRITE_CONFIG.audioCollectionId;
const fullCollectionId = APPWRITE_CONFIG.fullCollectionId;

const memoryDb = new Map<string, InterviewSession>();
const aiMemoryDb = new Map<string, AIInterviewSession>();
const audioMemoryDb = new Map<string, AudioInterviewSession>();
const fullMemoryDb = new Map<string, FullInterviewSession>();

async function saveAppwriteDocument(collectionId: string, documentId: string, data: any) {
  let attemptData = { ...data };
  while (true) {
    try {
      try {
        await databases.getDocument(databaseId, collectionId, documentId);
        await databases.updateDocument(databaseId, collectionId, documentId, attemptData);
      } catch (e: any) {
        if (e.code === 404) {
          await databases.createDocument(databaseId, collectionId, documentId, attemptData);
        } else {
          throw e;
        }
      }
      break;
    } catch (err: any) {
      const match =
        err.message &&
        (err.message.match(/Unknown attribute:\s*"([^"]+)"/i) ||
         err.message.match(/Attribute\s*"([^"]+)"\s*is not valid/i) ||
         err.message.match(/"([^"]+)"\s*document_invalid_structure/i));
      if (match && match[1]) {
        const attribute = match[1];
        if (attribute in attemptData) {
          console.warn(`Stripping unknown Appwrite attribute '${attribute}' from collection '${collectionId}'`);
          delete attemptData[attribute];
          continue;
        }
      }
      throw err;
    }
  }
}

export const dbService = {
  // ─── OA Sessions ──────────────────────────────────────────────────
  async getSession(sessionId: string): Promise<InterviewSession | null> {
    if (databaseId && oaCollectionId) {
      try {
        const doc = await databases.getDocument(databaseId, oaCollectionId, sessionId);
        if (doc && doc.sessionData) {
          return JSON.parse(doc.sessionData) as InterviewSession;
        }
      } catch (err: any) {
        console.warn("Appwrite getSession failed, falling back to memory:", err.message);
      }
    }
    return memoryDb.get(sessionId) || null;
  },

  async saveSession(session: InterviewSession): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updatedSession = { ...session, updatedAt };

    if (databaseId && oaCollectionId) {
      try {
        await saveAppwriteDocument(oaCollectionId, session.id, {
          userId: session.userId,
          interviewType: "oa",
          status: session.aptitudeStatus === "completed" ? "completed" : "in_progress",
          role: session.blueprint.role || "Developer",
          score: session.evaluation?.overallScore || 0,
          sessionData: JSON.stringify(updatedSession),
          createdAt: session.createdAt,
          updatedAt,
        });
      } catch (err: any) {
        console.warn("Appwrite saveSession failed, using memory only:", err.message);
      }
    }

    memoryDb.set(session.id, updatedSession);
  },

  async createSession(session: InterviewSession): Promise<void> {
    await this.saveSession(session);
  },

  async deleteSession(sessionId: string): Promise<void> {
    if (databaseId && oaCollectionId) {
      try {
        await databases.deleteDocument(databaseId, oaCollectionId, sessionId);
      } catch (err: any) {
        console.warn("Appwrite deleteSession failed:", err.message);
      }
    }
    memoryDb.delete(sessionId);
  },

  async listSessions(userId: string): Promise<InterviewSession[]> {
    if (databaseId && oaCollectionId) {
      try {
        const response = await databases.listDocuments(databaseId, oaCollectionId, [
          Query.equal("userId", userId),
          Query.equal("interviewType", "oa"),
        ]);
        return response.documents
          .map((doc) => JSON.parse(doc.sessionData) as InterviewSession)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch (err: any) {
        console.warn("Appwrite listSessions failed, using memory:", err.message);
      }
    }

    return Array.from(memoryDb.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  // ─── AI Sessions ──────────────────────────────────────────────────
  async getAISession(sessionId: string): Promise<AIInterviewSession | null> {
    if (databaseId && aiCollectionId) {
      try {
        const doc = await databases.getDocument(databaseId, aiCollectionId, sessionId);
        if (doc && doc.sessionData) {
          return JSON.parse(doc.sessionData) as AIInterviewSession;
        }
      } catch (err: any) {
        console.warn("Appwrite getAISession failed, falling back to memory:", err.message);
      }
    }
    return aiMemoryDb.get(sessionId) || null;
  },

  async saveAISession(session: AIInterviewSession): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updatedSession = { ...session, updatedAt };

    if (databaseId && aiCollectionId) {
      try {
        await saveAppwriteDocument(aiCollectionId, session.id, {
          userId: session.userId,
          interviewType: "ai",
          status: session.status,
          role: session.blueprint.role || "MERN Stack Developer",
          score: session.evaluation?.overallScore || 0,
          sessionData: JSON.stringify(updatedSession),
          createdAt: session.createdAt,
          updatedAt,
        });
      } catch (err: any) {
        console.warn("Appwrite saveAISession failed, using memory only:", err.message);
      }
    }

    aiMemoryDb.set(session.id, updatedSession);
  },

  async listAISessions(userId: string): Promise<AIInterviewSession[]> {
    if (databaseId && aiCollectionId) {
      try {
        const response = await databases.listDocuments(databaseId, aiCollectionId, [
          Query.equal("userId", userId),
          Query.equal("interviewType", "ai"),
        ]);
        return response.documents
          .map((doc) => JSON.parse(doc.sessionData) as AIInterviewSession)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch (err: any) {
        console.warn("Appwrite listAISessions failed, using memory:", err.message);
      }
    }

    return Array.from(aiMemoryDb.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  // ─── Audio Sessions ───────────────────────────────────────────────
  async getAudioSession(sessionId: string): Promise<AudioInterviewSession | null> {
    if (databaseId && audioCollectionId) {
      try {
        const doc = await databases.getDocument(databaseId, audioCollectionId, sessionId);
        if (doc && doc.sessionData) {
          return JSON.parse(doc.sessionData) as AudioInterviewSession;
        }
      } catch (err: any) {
        console.warn("Appwrite getAudioSession failed, falling back to memory:", err.message);
      }
    }
    return audioMemoryDb.get(sessionId) || null;
  },

  async saveAudioSession(session: AudioInterviewSession): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updatedSession = { ...session, updatedAt };

    if (databaseId && audioCollectionId) {
      try {
        await saveAppwriteDocument(audioCollectionId, session.id, {
          userId: session.userId,
          interviewType: "audio",
          status: session.status,
          role: session.blueprint.role || "Voice Mock Interview",
          score: session.evaluation?.overallScore || 0,
          sessionData: JSON.stringify(updatedSession),
          createdAt: session.createdAt,
          updatedAt,
        });
      } catch (err: any) {
        console.warn("Appwrite saveAudioSession failed, using memory only:", err.message);
      }
    }

    audioMemoryDb.set(session.id, updatedSession);
  },

  async listAudioSessions(userId: string): Promise<AudioInterviewSession[]> {
    if (databaseId && audioCollectionId) {
      try {
        const response = await databases.listDocuments(databaseId, audioCollectionId, [
          Query.equal("userId", userId),
          Query.equal("interviewType", "audio"),
        ]);
        return response.documents
          .map((doc) => JSON.parse(doc.sessionData) as AudioInterviewSession)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch (err: any) {
        console.warn("Appwrite listAudioSessions failed, using memory:", err.message);
      }
    }

    return Array.from(audioMemoryDb.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  // ─── Full E2E Sessions ────────────────────────────────────────────
  async getFullSession(sessionId: string): Promise<FullInterviewSession | null> {
    if (databaseId && fullCollectionId) {
      try {
        const doc = await databases.getDocument(databaseId, fullCollectionId, sessionId);
        if (doc && doc.sessionData) {
          return JSON.parse(doc.sessionData) as FullInterviewSession;
        }
      } catch (err: any) {
        console.warn("Appwrite getFullSession failed, falling back to memory:", err.message);
      }
    }
    return fullMemoryDb.get(sessionId) || null;
  },

  async saveFullSession(session: FullInterviewSession): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updatedSession = { ...session, updatedAt };

    if (databaseId && fullCollectionId) {
      try {
        await saveAppwriteDocument(fullCollectionId, session.id, {
          userId: session.userId,
          interviewType: "full",
          status: session.status,
          role: session.blueprint.role || "Full End-to-End Interview",
          score: session.evaluation?.overallScore || 0,
          sessionData: JSON.stringify(updatedSession),
          createdAt: session.createdAt,
          updatedAt,
        });
      } catch (err: any) {
        console.warn("Appwrite saveFullSession failed, using memory only:", err.message);
      }
    }

    fullMemoryDb.set(session.id, updatedSession);
  },

  async deleteFullSession(sessionId: string): Promise<void> {
    if (databaseId && fullCollectionId) {
      try {
        await databases.deleteDocument(databaseId, fullCollectionId, sessionId);
      } catch (err: any) {
        console.warn("Appwrite deleteFullSession failed:", err.message);
      }
    }
    fullMemoryDb.delete(sessionId);
  },

  async listFullSessions(userId: string): Promise<FullInterviewSession[]> {
    if (databaseId && fullCollectionId) {
      try {
        const response = await databases.listDocuments(databaseId, fullCollectionId, [
          Query.equal("userId", userId),
          Query.equal("interviewType", "full"),
        ]);
        return response.documents
          .map((doc) => JSON.parse(doc.sessionData) as FullInterviewSession)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch (err: any) {
        console.warn("Appwrite listFullSessions failed, using memory:", err.message);
      }
    }

    return Array.from(fullMemoryDb.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};

