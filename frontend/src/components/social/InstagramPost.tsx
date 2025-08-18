"use client";
import React, { useEffect, useRef } from 'react';

export function InstagramPost({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const el = ref.current;
    if (!el) return;
    const load = () => {
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        (window as any).instgrm?.Embeds?.process();
      };
      document.body.appendChild(script);
    };
    observer = new IntersectionObserver((entries) => {
      entries.forEach(ent => { if (ent.isIntersecting) { load(); observer?.disconnect(); } });
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer?.disconnect();
  }, [url]);

  return (
    <div ref={ref} className="w-full">
      <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" style={{ background:'#0f1725', border:0, margin:0, padding:0, width:'100%' }}>
        <div className="text-xs text-slate-400">Cargando publicación...</div>
      </blockquote>
    </div>
  );
}
