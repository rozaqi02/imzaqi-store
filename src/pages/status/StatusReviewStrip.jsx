import React, { useState } from "react";
import { ArrowUpRight, Send, Star } from "lucide-react";
import { fireConfetti } from "../../components/Confetti";
import { trackFunnelEvent } from "../../lib/funnelAnalytics";
import { supabase } from "../../lib/supabaseClient";
import { getSafeOrderItems } from "./statusHelpers";

const RATING_LABELS = {
  5: "Sangat Puas",
  4: "Puas & Lancar",
  3: "Cukup Baik",
  2: "Kurang Puas",
  1: "Perlu Peningkatan",
};

const QUICK_CHIPS = [
  "Akun Kilat",
  "Garansi Aman",
  "Admin Responsif",
  "Harga Pas",
  "Rekomen",
];

export default function StatusReviewStrip({ order, waUrl, toast }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(() => {
    try {
      const saved =
        typeof window !== "undefined" && window.localStorage
          ? localStorage.getItem(`imzaqi_review_${order?.order_code}`)
          : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const activeStarCount = hoverRating || rating;

  function handleSelectStar(star) {
    setRating(star);
    setExpanded(true);
  }

  function handleAddChip(chip) {
    setReviewText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      return `${trimmed}, ${chip}`;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const effectiveText =
      reviewText.trim() || "Pelayanan memuaskan, pesanan cepat sampai dan akun berfungsi lancar!";
    const effectiveAuthor = authorName.trim() || "Pelanggan Terverifikasi";
    const reviewData = {
      orderCode: order.order_code,
      rating,
      reviewText: effectiveText,
      authorName: effectiveAuthor,
      submittedAt: new Date().toISOString(),
    };

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(`imzaqi_review_${order.order_code}`, JSON.stringify(reviewData));
      }
      trackFunnelEvent("order_reviewed", {
        orderCode: order.order_code,
        rating,
        text: effectiveText,
      });
      fireConfetti();

      if (typeof supabase?.from === "function") {
        const firstItem = getSafeOrderItems(order?.items)[0];
        const iconUrl = firstItem?.product_icon_url || "/icon.png";
        const basePayload = {
          image_url: iconUrl,
          caption: `[${rating}/5] "${effectiveText}", ${effectiveAuthor} (#${order.order_code})`,
          is_active: false,
          sort_order: 100,
        };
        const richPayload = {
          ...basePayload,
          product_name: String(firstItem?.product_name || "").trim() || null,
          customer_name: effectiveAuthor,
          rating,
          is_verified: true,
        };
        const res = await supabase.from("testimonials").insert([richPayload]);
        if (res?.error) {
          await supabase.from("testimonials").insert([basePayload]);
        }
      }

      setExistingReview(reviewData);
      toast?.success?.("Terima kasih atas ulasanmu!");
    } catch {
      setExistingReview(reviewData);
      toast?.success?.("Terima kasih atas ulasanmu!");
    } finally {
      setSubmitting(false);
    }
  }

  function buildWaReviewUrl(rev) {
    if (!waUrl) return "";
    const msg = encodeURIComponent(
      `Halo Admin Imzaqi Store! Saya ingin memberikan ulasan untuk pesanan #${order.order_code}:\n\n` +
        `Rating: ${rev.rating}/5 (${RATING_LABELS[rev.rating] || "Puas"})\n` +
        `Ulasan: "${rev.reviewText}"\n` +
        `Oleh: ${rev.authorName}\n\n` +
        `Terima kasih banyak atas pelayanannya!`
    );
    const baseUrl = waUrl.split("?")[0];
    return `${baseUrl}?text=${msg}`;
  }

  if (existingReview) {
    const waShareUrl = buildWaReviewUrl(existingReview);
    return (
      <article className="st-card st-reviewStrip is-submitted">
        <div className="st-reviewCompactBar">
          <div className="st-reviewSubmittedSummary">
            <div
              className="st-reviewSubmittedStars"
              aria-label={`Rating ${existingReview.rating} dari 5 bintang`}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  fill={star <= existingReview.rating ? "#f5a623" : "transparent"}
                  color={star <= existingReview.rating ? "#f5a623" : "var(--st-muted)"}
                  aria-hidden="true"
                />
              ))}
              <span className="st-reviewRatingBadge">{existingReview.rating}.0/5</span>
              <span className="st-reviewVerifiedPill">Ulasan terkirim</span>
            </div>
            <p className="st-reviewSubmittedLine">
              "{existingReview.reviewText}" — <span>{existingReview.authorName}</span>
            </p>
          </div>

          {waShareUrl ? (
            <a
              className="btn btn-ghost btn-sm"
              href={waShareUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>Bagikan ke WA</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="st-card st-reviewStrip">
      <div className="st-reviewCompactBar">
        <div className="st-reviewPromptText">
          <strong>Pesanan selesai? Beri rating:</strong>
          <span className="st-reviewRatingFeedback">{RATING_LABELS[activeStarCount]}</span>
        </div>

        <div className="st-reviewBarControls">
          <div className="st-reviewStarsPicker" role="radiogroup" aria-label="Rating bintang">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`st-reviewStarBtn${star <= activeStarCount ? " is-active" : ""}`}
                onClick={() => handleSelectStar(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} bintang`}
              >
                <Star
                  size={20}
                  fill={star <= activeStarCount ? "#f5a623" : "transparent"}
                  color={star <= activeStarCount ? "#f5a623" : "var(--st-muted)"}
                />
              </button>
            ))}
          </div>

          {!expanded ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded(true)}
            >
              Tulis ulasan
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <form onSubmit={handleSubmit} className="st-reviewForm">
          <div className="st-reviewChipsRow" aria-label="Saran cepat">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="st-reviewChip"
                onClick={() => handleAddChip(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="st-reviewFieldsRow">
            <textarea
              className="input st-reviewTextarea"
              rows={2}
              placeholder="Ceritakan pengalamanmu (opsional)..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <input
              type="text"
              className="input st-reviewNameInput"
              placeholder="Nama kamu (opsional)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>

          <div className="st-reviewSubmitRow">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded(false)}
              disabled={submitting}
            >
              Tutup
            </button>
            <button type="submit" className="btn btn-sm" disabled={submitting}>
              <Send size={14} aria-hidden="true" />
              <span>{submitting ? "Mengirim..." : "Kirim Ulasan"}</span>
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
