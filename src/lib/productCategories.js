import {
  Blocks,
  Bot,
  Film,
  GraduationCap,
  Music4,
  Palette,
  Sparkles,
} from "lucide-react";

export const PRODUCT_CATEGORIES = [
  { key: "streaming", label: "Streaming", icon: Film },
  { key: "music", label: "Music", icon: Music4 },
  { key: "tools", label: "Tools", icon: Blocks },
  { key: "ai", label: "AI", icon: Bot },
  { key: "design", label: "Design", icon: Palette },
  { key: "learning", label: "Belajar", icon: GraduationCap },
  { key: "other", label: "Lainnya", icon: Sparkles },
];

function inferCategoryFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.match(/netflix|youtube|disney|prime|wetv|viu|iqiyi|hbo|hulu/)) return "streaming";
  if (n.match(/spotify|joox|apple music|yt music|deezer/)) return "music";
  if (n.match(/canva|figma|adobe|photoshop|illustrator/)) return "design";
  if (n.match(/chatgpt|copilot|midjourney|claude|gemini|perplexity/)) return "ai";
  if (n.match(/zoom|notion|office|capcut|alight|github|grammarly/)) return "tools";
  if (n.match(/coursera|udemy|skillshare|duolingo/)) return "learning";
  return "other";
}

export function resolveProductCategory(product) {
  const explicit = String(product?.category || "").trim().toLowerCase();
  const key = PRODUCT_CATEGORIES.some((item) => item.key === explicit)
    ? explicit
    : inferCategoryFromName(product?.name);

  return PRODUCT_CATEGORIES.find((item) => item.key === key) || PRODUCT_CATEGORIES.at(-1);
}