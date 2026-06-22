export function throttle(fn, fps = 60) {
  const interval = 1000 / fps;
  let lastCall = 0;
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;

  const invoke = (now) => {
    lastCall = now;
    fn.apply(lastThis, lastArgs);
    timeoutId = null;
  };

  const throttled = function (...args) {
    const now = performance.now();
    const elapsed = now - lastCall;
    lastArgs = args;
    lastThis = this;

    if (elapsed >= interval) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      invoke(now);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => invoke(performance.now()), interval - elapsed);
    }
  };

  throttled.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    lastCall = 0;
  };

  return throttled;
}

export function rafThrottle(fn) {
  let frame = null;
  let lastArgs = null;
  let lastThis = null;

  const throttled = function (...args) {
    lastArgs = args;
    lastThis = this;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      fn.apply(lastThis, lastArgs);
      frame = null;
    });
  };

  throttled.cancel = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  };

  return throttled;
}
