import { NextRequest, NextResponse } from "next/server";
import { extractJobDescription } from "@/src/ocr";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided in request." },
        { status: 400 }
      );
    }

    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF document." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await extractJobDescription(buffer, file.name);

    return NextResponse.json({
      success: true,
      jd: result.data,
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error("Job Description OCR API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process and parse Job Description PDF." },
      { status: 500 }
    );
  }
}
