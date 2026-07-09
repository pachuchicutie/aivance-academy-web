"use client";

import { useEffect, useRef } from "react";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const vid = videoRef.current;
    if (reduceMotion && vid) {
      vid.pause();
      vid.style.display = "none";
    }
  }, []);

  return (
    <div className="holo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="poster"
        src="/hero-poster.jpg"
        alt="AIvance Academy logo hovering above a glowing futuristic platform"
      />
      <video
        ref={videoRef}
        id="heroVideo"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      <span className="holo-tag">
        AIvance&nbsp;//&nbsp;Learn&nbsp;·&nbsp;Build&nbsp;·&nbsp;Advance
      </span>
    </div>
  );
}
