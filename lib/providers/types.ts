import type { COTSnapshot, Instrument, PriceSnapshot, SentimentSnapshot, VolatilitySnapshot } from "@/lib/types/analysis";

export interface PriceDataProvider {
  getSnapshot(instrument: Instrument): Promise<PriceSnapshot>;
}

export interface COTDataProvider {
  getSnapshot(instrument: Instrument): Promise<COTSnapshot>;
}

export interface SentimentDataProvider {
  getSnapshot(instrument: Instrument): Promise<SentimentSnapshot>;
}

export interface VolatilityDataProvider {
  getSnapshot(instrument: Instrument): Promise<VolatilitySnapshot>;
}