export type EventStatus = 'available' | 'maybe_available' | 'unavailable';
export type DemandBand = 'low' | 'medium' | 'high' | 'very_high';
export type ActivityType =
  | 'watcher_added'
  | 'status_change'
  | 'alert_sent'
  | 'demand_spike'
  | 'page_change'
  | 'metadata_updated'
  | 'watcher_spike'
  | 'availability_detected'
  | 'recheck_confirmed'
  | 'source_unstable';

export interface Event {
  id: number;
  title: string;
  event_url: string;
  status: EventStatus;
  last_status: EventStatus;
  last_triggered_at: Date | null;
  last_page_hash: string | null;
  source_name: string | null;
  source_logo: string | null;
  hero_image: string | null;
  event_date: string | null;
  location: string | null;
  watchers_count: number;
  demand_score: number;
  demand_band: DemandBand;
  priority_score: number;
  check_interval: number;
  next_check_at: Date | null;
  recent_transition_count: number;
  recent_signal_strength: number;
  source_reliability_score: number;
  metadata_last_updated_at: Date | null;
  last_checked: Date | null;
  created_at: Date;
}

export interface SignalResult {
  status: EventStatus;
  confidence: number;
  positiveSignals: string[];
  negativeSignals: string[];
  buttonSignals: string[];
  domSignals: string[];
  availabilityHints: string[];
  snippet: string;
}

export interface SourceInfo {
  sourceName: string;
  sourceLogo: string;
}

export interface MetadataResult {
  title: string | null;
  heroImage: string | null;
  eventDate: string | null;
  location: string | null;
}

export interface ActivityFeedItem {
  id: number;
  eventId: number;
  eventTitle: string;
  type: ActivityType;
  message: string;
  createdAt: Date;
}

export interface AlertPayload {
  eventId: number;
  eventTitle: string;
  status: EventStatus;
  detectedSignals: string[];
  url: string;
  recipientEmail: string;
}

export interface DemandResult {
  score: number;
  band: DemandBand;
  watchersCount: number;
  trend: string;
}

export interface SourceParser {
  extractSignals(html: string): SignalResult;
  extractMetadata(html: string): MetadataResult;
}

export interface EventIntelligence {
  eventId: number;
  title: string;
  status: EventStatus;
  watchersCount: number;
  demandScore: number;
  demandBand: DemandBand;
  demandTrend: string;
  recentActivityCount: number;
  recentChecks: number;
  lastMeaningfulChange: Date | null;
  sourceReliability: number;
  heroImage: string | null;
  eventDate: string | null;
  location: string | null;
}
