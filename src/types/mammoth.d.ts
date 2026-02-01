/**
 * Type declarations for mammoth.js
 * DOCX to HTML converter
 */

declare module "mammoth" {
  export interface ConvertResult {
    value: string;
    messages: Array<{
      type: "warning" | "error";
      message: string;
    }>;
  }

  export interface ConvertOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }

  export function convertToHtml(options: ConvertOptions): Promise<ConvertResult>;
  export function extractRawText(options: ConvertOptions): Promise<ConvertResult>;
}
