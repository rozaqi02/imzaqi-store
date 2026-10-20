import React from 'react';

// Daftar 10 pose sesuai urutan gambar (5 kolom x 2 baris)
export const MASCOT_POSES = {
  // Baris Atas
  happy:    { col: 0, row: 0, anim: 'imzaqi-jump',   label: 'Senang' },
  sad:      { col: 1, row: 0, anim: 'imzaqi-sad',    label: 'Sedih' },
  angry:    { col: 2, row: 0, anim: 'imzaqi-angry',  label: 'Marah' },
  thumbsUp: { col: 3, row: 0, anim: 'imzaqi-pop',    label: 'Jempol / Sukses' },
  confused: { col: 4, row: 0, anim: 'imzaqi-wobble', label: 'Bingung' },

  // Baris Bawah
  scared:   { col: 0, row: 1, anim: 'imzaqi-shiver', label: 'Takut / Error' },
  wave:     { col: 1, row: 1, anim: 'imzaqi-wave',   label: 'Menyapa' },
  thinking: { col: 2, row: 1, anim: 'imzaqi-float',  label: 'Berpikir / Loading' },
  sleepy:   { col: 3, row: 1, anim: 'imzaqi-sleep',  label: 'Mengantuk / Kosong' },
  love:     { col: 4, row: 1, anim: 'imzaqi-squish', label: 'Suka / Favorit' },
};

export default function ImzaqiMascot({
  pose = 'happy',
  size = 150,
  src = '/mascot-sheet.png', // Mengambil dari folder public/mascot-sheet.png
  animate = true,
  className = '',
  style = {}
}) {
  const current = MASCOT_POSES[pose] || MASCOT_POSES.happy;

  // Koordinat potong untuk grid 5 kolom x 2 baris
  const posX = (current.col / 4) * 100;
  const posY = (current.row / 1) * 100;

  // Rasio 1 cell dari grid 5x2 sheet 1024x571: (571 / 2) / (1024 / 5) = ~1.394
  // Proporsi pas & bulat natural tanpa distorsi/gepeng
  const cellHeight = Math.round(size * 1.394);

  return (
    <div 
      className={`imzaqi-mascot-wrapper ${className}`} 
      style={{ 
        display: 'inline-flex', 
        justifyContent: 'center',
        alignItems: 'center',
        padding: `${size * 0.08}px`, // Ruang ekstra agar saat membal tidak terpotong
        ...style 
      }}
    >
      <style>{`
        .imzaqi-sprite-box {
          background-repeat: no-repeat;
          background-size: 500% 200%;
          transform-origin: bottom center;
          will-change: transform;
          user-select: none;
        }

        /* 1. Happy: Melompat membal seperti jelly */
        @keyframes imzaqi-jump {
          0%, 100% { transform: translateY(0) scale(1, 1); }
          25% { transform: translateY(0) scale(1.12, 0.88); }
          50% { transform: translateY(-14%) scale(0.92, 1.08); }
          80% { transform: translateY(0) scale(1.06, 0.94); }
        }

        /* 2. Sad: Merunduk lemas */
        @keyframes imzaqi-sad {
          0%, 100% { transform: scale(1, 1) rotate(0deg); }
          50% { transform: scale(1.05, 0.93) rotate(-3deg) translateY(3%); }
        }

        /* 3. Angry: Bergetar marah */
        @keyframes imzaqi-angry {
          0%, 100% { transform: scale(1) translateX(0); }
          20% { transform: scale(1.07, 0.95) translateX(-3%) rotate(-2deg); }
          40% { transform: scale(0.95, 1.07) translateX(3%) rotate(2deg); }
          60% { transform: scale(1.07, 0.95) translateX(-3%) rotate(-2deg); }
          80% { transform: scale(1.02) translateX(2%); }
        }

        /* 4. ThumbsUp: Membal bangga */
        @keyframes imzaqi-pop {
          0%, 100% { transform: scale(1) rotate(0deg); }
          35% { transform: scale(1.1, 0.9); }
          65% { transform: scale(0.95, 1.06) rotate(3deg) translateY(-4%); }
        }

        /* 5. Confused: Miring kanan-kiri */
        @keyframes imzaqi-wobble {
          0%, 100% { transform: rotate(0deg) scale(1); }
          33% { transform: rotate(-6deg) scale(1.03, 0.97); }
          66% { transform: rotate(5deg) scale(0.97, 1.03); }
        }

        /* 6. Scared: Gemetar ketakutan */
        @keyframes imzaqi-shiver {
          0%, 100% { transform: translate(0, 0) scale(1, 1); }
          25% { transform: translate(-2%, 1%) scale(0.98, 1.02); }
          50% { transform: translate(2%, -1%) scale(1.02, 0.98); }
          75% { transform: translate(-2%, -1%) scale(0.98, 1.02); }
        }

        /* 7. Wave: Mengayun menyapa */
        @keyframes imzaqi-wave {
          0%, 100% { transform: rotate(-3deg) scale(1, 1); }
          50% { transform: rotate(4deg) scale(1.03, 0.97) translateY(-3%); }
        }

        /* 8. Thinking: Naik turun halus */
        @keyframes imzaqi-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-7%) scale(0.98, 1.02); }
        }

        /* 9. Sleepy: Bernapas lambat */
        @keyframes imzaqi-sleep {
          0%, 100% { transform: scale(1, 1) rotate(0deg); }
          50% { transform: scale(1.06, 0.93) rotate(2deg) translateY(2%); }
        }

        /* 10. Love: Membal gemas */
        @keyframes imzaqi-squish {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.14, 0.88); }
          50% { transform: scale(0.92, 1.1) translateY(-5%); }
          75% { transform: scale(1.05, 0.96); }
        }
      `}</style>

      <div
        className="imzaqi-sprite-box"
        role="img"
        aria-label={`Maskot ${current.label}`}
        title={current.label}
        style={{
          width: `${size}px`,
          height: `${cellHeight}px`,
          backgroundImage: `url('${src}')`,
          backgroundPosition: `${posX}% ${posY}%`,
          animation: animate ? `${current.anim} 1.8s infinite ease-in-out` : 'none',
        }}
      />
    </div>
  );
}
