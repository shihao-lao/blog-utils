export interface HotTopic {
  id: string;
  source: string;
  title: string;
  url?: string;
  description?: string;
  heat_score: number;
  category: string;
  keywords: string[];
  images: string[];
  is_sensitive: number;
  is_processed: number;
  created_at: string;
  updated_at: string;
}

export interface AiContent {
  id: string;
  topic_id: string;
  title: string;
  body: string;
  cover_text?: string;
  tags: string[];
  category?: string;
  content_type?: string;
  images: string[];
  emotion_score: number;
  quality_score: number;
  midjourney_prompt?: string;
  sd_prompt?: string;
  flux_prompt?: string;
  comment_guide?: string;
  ai_provider?: string;
  ai_model?: string;
  status: string;
  review_structure_score?: number;
  review_content_score?: number;
  review_tone_score?: number;
  review_opening_score?: number;
  review_ending_score?: number;
  review_overall_score?: number;
  review_passed?: number;
  review_issues?: string;
  review_suggestions?: string;
  created_at: string;
  updated_at: string;
}

export interface PublishRecord {
  id: string;
  content_id: string;
  platform: string;
  status: string;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  retry_count: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskQueueItem {
  id: string;
  task_type: string;
  payload: string;
  priority: number;
  status: string;
  result?: string;
  error?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}
