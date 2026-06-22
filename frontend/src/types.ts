export interface User {
  id: string;
  email: string;
}

export interface Report {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  page_count: number | null;
  status: string;
  created_at: string;
}

export type ReadingLevel = 'basic' | 'intermediate' | 'medical';

export interface Explanation {
  id: string;
  explanation_text: string;
  reading_level: ReadingLevel;
  disclaimer: string;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
  visits?: number;
  duration_ms?: number;
}

export interface ExplanationMarker {
  x: number;
  y: number;
  region_text: string;
}

export interface SectionStat {
  label: string;
  visit_count: number;
  explanation_count: number;
  page_number: number;
}

export interface AnalyticsData {
  total_views: number;
  total_explanations: number;
  top_viewed_sections: SectionStat[];
  top_explained_terms: SectionStat[];
}

export interface GazePoint {
  page_number: number;
  x: number;
  y: number;
  duration_ms: number;
}

export const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const DISCLAIMER =
  'This explanation is educational only and not medical advice.';
