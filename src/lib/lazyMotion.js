import React from "react";

let motionModule = null;

export async function loadMotion() {
  if (motionModule) return motionModule;
  motionModule = await import("framer-motion");
  return motionModule;
}

export function LazyMotionDiv(props) {
  const [motion, setMotion] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    loadMotion().then((mod) => {
      if (alive) setMotion(mod.motion);
    });
    return () => { alive = false; };
  }, []);
  if (!motion) return <div {...props} />;
  const M = motion.div;
  return <M {...props} />;
}