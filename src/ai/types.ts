export interface AiGenerationRequest {
  title: string;
  description?: string;
  category: string;
  keywords: string[];
  source: string;
}

export interface AiGenerationResult {
  title: string;
  body: string;
  coverText: string;
  tags: string[];
  commentGuide: string;
  midjourneyPrompt: string;
  sdPrompt: string;
  fluxPrompt: string;
  emotionScore: number;
  qualityScore: number;
}

export interface AiProvider {
  name: string;
  generate(prompt: string): Promise<string>;
}
