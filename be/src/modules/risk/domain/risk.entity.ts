// WHY: Contract type của risk engine (rules thuần — LLM chỉ explainer,
// xem skill fw-ai-night-watch). Score CHỈ trì hoãn, không bao giờ tự cancel.
export type RiskAssessment = {
  score: number; // 0..100
  signals: string[];
  recommendedDelaySecs: number;
};
