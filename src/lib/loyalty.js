const COUNT_KEY = "imzaqi_completed_orders_v1";
const REWARD_KEY = "imzaqi_loyalty_reward_v1";
const REWARD_THRESHOLD = 3;
export const LOYALTY_PROMO_CODE = "PELANGGAN3";

export function getCompletedOrderCount() {
  try {
    return Number(localStorage.getItem(COUNT_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

const RECORDED_ORDERS_KEY = "imzaqi_recorded_orders_v1";

function getRecordedOrderCodes() {
  try {
    const raw = localStorage.getItem(RECORDED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordCompletedOrder(orderCode) {
  try {
    if (orderCode) {
      const code = String(orderCode).trim().toUpperCase();
      const recorded = getRecordedOrderCodes();
      if (recorded.includes(code)) {
        return { count: getCompletedOrderCount(), unlocked: false };
      }
      recorded.push(code);
      localStorage.setItem(RECORDED_ORDERS_KEY, JSON.stringify(recorded));
    }
    const next = getCompletedOrderCount() + 1;
    localStorage.setItem(COUNT_KEY, String(next));
    if (next >= REWARD_THRESHOLD && !localStorage.getItem(REWARD_KEY)) {
      localStorage.setItem(REWARD_KEY, "pending");
      return { count: next, unlocked: true };
    }
    return { count: next, unlocked: false };
  } catch {
    return { count: 0, unlocked: false };
  }
}

export function getLoyaltyStatus() {
  const count = getCompletedOrderCount();
  const remaining = Math.max(0, REWARD_THRESHOLD - count);
  try {
    const rewardClaimed = localStorage.getItem(REWARD_KEY) === "claimed";
    const rewardPending = localStorage.getItem(REWARD_KEY) === "pending";
    return { count, remaining, rewardClaimed, rewardPending, threshold: REWARD_THRESHOLD };
  } catch {
    return { count, remaining, rewardClaimed: false, rewardPending: false, threshold: REWARD_THRESHOLD };
  }
}

export function markLoyaltyRewardClaimed() {
  try {
    localStorage.setItem(REWARD_KEY, "claimed");
  } catch {}
}