const ACHIEVEMENTS_KEY = "imzaqi_achievements_v1";
const SEEN_KEY = "imzaqi_achievements_seen_v1";

const ACHIEVEMENT_DEFS = [
  {
    id: "first_order",
    title: "Pertama Kali 🎉",
    desc: "Order pertama kamu!",
    icon: "🎉",
    check: (history) => history.length >= 1,
  },
  {
    id: "fifth_order",
    title: "Makin Sering 🛒",
    desc: "Udah 5x order!",
    icon: "🛒",
    check: (history) => history.length >= 5,
  },
  {
    id: "tenth_order",
    title: "Pelanggan Setia 💎",
    desc: "10x order, mantap!",
    icon: "💎",
    check: (history) => history.length >= 10,
  },
  {
    id: "streak_2",
    title: "Rajin Banget 📆",
    desc: "Order 2 bulan berturut-turut",
    icon: "📆",
    check: (history) => {
      const months = [...new Set(
        history
          .filter((e) => e.status === "done")
          .map((e) => {
            const d = new Date(e.created_at || 0);
            return `${d.getFullYear()}-${d.getMonth()}`;
          })
      )].sort();
      if (months.length < 2) return false;
      let streak = 1;
      for (let i = 0; i < months.length - 1; i++) {
        const [y1, m1] = months[i].split("-").map(Number);
        const [y2, m2] = months[i + 1].split("-").map(Number);
        if ((y2 * 12 + m2) - (y1 * 12 + m1) === 1) streak++;
        else streak = 1;
      }
      return streak >= 2;
    },
  },
  {
    id: "streak_3",
    title: "Langganan Tetap 🔥",
    desc: "Order 3 bulan berturut-turut!",
    icon: "🔥",
    check: (history) => {
      const months = [...new Set(
        history
          .filter((e) => e.status === "done")
          .map((e) => {
            const d = new Date(e.created_at || 0);
            return `${d.getFullYear()}-${d.getMonth()}`;
          })
      )].sort();
      if (months.length < 3) return false;
      let streak = 1;
      for (let i = 0; i < months.length - 1; i++) {
        const [y1, m1] = months[i].split("-").map(Number);
        const [y2, m2] = months[i + 1].split("-").map(Number);
        if ((y2 * 12 + m2) - (y1 * 12 + m1) === 1) streak++;
        else streak = 1;
      }
      return streak >= 3;
    },
  },
];

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function getUnlockedAchievements() {
  return safeGet(ACHIEVEMENTS_KEY, []);
}

export function getSeenAchievements() {
  return safeGet(SEEN_KEY, []);
}

function markSeen(ids) {
  const seen = getSeenAchievements();
  ids.forEach((id) => { if (!seen.includes(id)) seen.push(id); });
  safeSet(SEEN_KEY, seen);
}

export function checkAchievements(history) {
  const unlocked = getUnlockedAchievements();
  const newOnes = [];

  ACHIEVEMENT_DEFS.forEach((def) => {
    if (!unlocked.includes(def.id) && def.check(history)) {
      unlocked.push(def.id);
      newOnes.push(def);
    }
  });

  if (newOnes.length > 0) {
    safeSet(ACHIEVEMENTS_KEY, unlocked);
  }

  return newOnes;
}

export function getNewAchievements(history) {
  const unlocked = getUnlockedAchievements();
  const seen = getSeenAchievements();
  const unseen = unlocked.filter((id) => !seen.includes(id));
  if (unseen.length === 0) return [];
  markSeen(unseen);
  return unseen.map((id) => ACHIEVEMENT_DEFS.find((d) => d.id === id)).filter(Boolean);
}
