import React, { useState, useEffect } from "react";

function useTypewriter(words) {
  const [text, setText] = useState("Ketik nama produk..");

  useEffect(() => {
    let wordIdx = 0, charIdx = 0, deleting = false, timer;
    const naturalDelay = () => 55 + Math.random() * 65;

    const tick = () => {
      const word = words[wordIdx];
      if (deleting) {
        charIdx--;
        setText(`Ketik "${word.slice(0, charIdx)}"`);
        timer = setTimeout(tick, charIdx === 0 ? 480 : 38);
        if (charIdx === 0) {
          deleting = false;
          wordIdx = (wordIdx + 1) % words.length;
        }
      } else {
        charIdx++;
        setText(`Ketik "${word.slice(0, charIdx)}"`);
        if (charIdx === word.length) {
          deleting = true;
          timer = setTimeout(tick, 1600 + Math.random() * 400);
        } else timer = setTimeout(tick, naturalDelay());
      }
    };

    timer = setTimeout(tick, 1200);
    return () => clearTimeout(timer);
  }, [words]);

  return text;
}

const TypewriterSearchInput = React.forwardRef(function TypewriterSearchInput(
  { words, ...props },
  ref
) {
  const placeholderText = useTypewriter(words);
  return (
    <input
      ref={ref}
      placeholder={placeholderText}
      {...props}
    />
  );
});

export default TypewriterSearchInput;
