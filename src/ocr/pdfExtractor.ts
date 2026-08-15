import { extractText, getDocumentProxy } from "unpdf";

export interface PDFExtractionOutput {
  text: string;
  pages: string[];
  pageCount: number;
  info?: Record<string, any>;
}

/**
 * Extracts raw textual content and page details from a PDF buffer using unpdf.
 */
export async function extractTextFromPDF(
  pdfBuffer: ArrayBuffer | Uint8Array | Buffer
): Promise<PDFExtractionOutput> {
  try {
    // unpdf / pdfjs-dist strictly rejects Node Buffer instances and requires pure Uint8Array
    let uint8Array: Uint8Array;
    if (Buffer.isBuffer(pdfBuffer)) {
      const ab = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength
      );
      uint8Array = new Uint8Array(ab);
    } else if (pdfBuffer instanceof Uint8Array) {
      const ab = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength
      );
      uint8Array = new Uint8Array(ab);
    } else {
      uint8Array = new Uint8Array(pdfBuffer);
    }

    // Extract text with page-level separation
    const { text, totalPages } = await extractText(uint8Array, { mergePages: false });

    const pages = Array.isArray(text) ? text : [text];
    const mergedText = pages.join("\n\n").trim();

    return {
      text: mergedText,
      pages,
      pageCount: totalPages || pages.length || 1,
    };
  } catch (error: any) {
    console.error("PDF Extraction failed with unpdf:", error);
    throw new Error(`Failed to extract text from PDF: ${error.message || "Unknown error"}`);
  }
}
