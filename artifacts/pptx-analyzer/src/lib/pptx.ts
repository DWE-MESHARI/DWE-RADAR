import { analyzeSlides } from "./analyze";
import { readPowerPoint } from "./pptx-reader";
import type { PresentationAnalysis } from "./types";

export type {
  Finding,
  PresentationAsset,
  PresentationAnalysis,
  PowerPointReadResult,
  SlideRecord,
  UserNote,
} from "./types";

export async function parsePresentation(
  file: File,
): Promise<PresentationAnalysis> {
  const { slides, imageAssets } = await readPowerPoint(file);
  return analyzeSlides(file.name, slides, imageAssets);
}
