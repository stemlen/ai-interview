import type { InterviewSession, OAReport } from "@/src/types";
import { dbService } from "./db.service";
import { buildOAReport } from "./report-engine";

export class ReportService {
  async generateAndSaveReport(session: InterviewSession): Promise<OAReport> {
    if (!session.evaluation) {
      throw new Error("Cannot generate assessment report: session is not evaluated yet.");
    }

    const report = await buildOAReport(session);

    const updatedSession: InterviewSession = {
      ...session,
      report,
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveSession(updatedSession);
    return report;
  }
}

export const reportService = new ReportService();
