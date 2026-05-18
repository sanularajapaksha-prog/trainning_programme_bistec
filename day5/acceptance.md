// rule-based-categoriser.ts
// Fallback categoriser — runs when LLM or OCR is unavailable
// Confidence capped at 0.5 for all rule-based results (per spec)

export type Category = "Meals" | "Travel" | "Lodging" | "Office Supplies" | "Other";

export interface CategoriserResult {
  category: Category;
  confidence: number;
  source: "llm" | "rule-based";
  needsReview: boolean;
}

// Keyword map — Engineering owns this list in v1 (see OQ-3 in spec)
const KEYWORD_MAP: Record<Category, string[]> = {
  Meals: [
    "restaurant", "cafe", "coffee", "food", "lunch", "dinner", "breakfast",
    "burger", "pizza", "mcdonalds", "kfc", "meal", "bill", "dining",
  ],
  Travel: [
    "uber", "taxi", "cab", "fuel", "petrol", "flight", "airline", "bus",
    "train", "transport", "fare", "toll", "parking",
  ],
  Lodging: [
    "hotel", "hostel", "inn", "accommodation", "room", "stay", "airbnb",
    "resort", "lodge", "night",
  ],
  "Office Supplies": [
    "pen", "paper", "stationery", "printer", "ink", "notebook", "stapler",
    "office", "supplies", "toner", "cartridge",
  ],
  Other: [],
};

export function runRuleBased(ocrText: string): CategoriserResult {
  // No text → OCR failed path
  if (!ocrText || ocrText.trim().length === 0) {
    return {
      category: "Other",
      confidence: 0.0,
      source: "rule-based",
      needsReview: true,
    };
  }

  const lower = ocrText.toLowerCase();
  const scores: Record<Category, number> = {
    Meals: 0,
    Travel: 0,
    Lodging: 0,
    "Office Supplies": 0,
    Other: 0,
  };

  // Count keyword hits per category
  for (const [cat, keywords] of Object.entries(KEYWORD_MAP) as [Category, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[cat]++;
    }
  }

  // Find top category
  let topCategory: Category = "Other";
  let topScore = 0;
  for (const [cat, score] of Object.entries(scores) as [Category, number][]) {
    if (score > topScore) {
      topScore = score;
      topCategory = cat;
    }
  }

  // Confidence: cap at 0.5 (spec rule for all rule-based results)
  const rawConfidence = topScore > 0 ? Math.min(0.5, topScore * 0.15) : 0.0;
  const confidence = parseFloat(rawConfidence.toFixed(2));

  return {
    category: topCategory,
    confidence,
    source: "rule-based",
    needsReview: true, // always true for rule-based (confidence always <= 0.5 < 0.6)
  };
}
