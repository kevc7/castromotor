"use client";
import React, { useEffect, useRef, useState } from 'react';

function normalizeFacebookUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Remove tracking params/fragments
    u.hash = '';
    ['rdid','ref','mibextid','locale','__cft__','__tn__','igsh'].forEach(p => u.searchParams.delete(p));
    const path = u.pathname;
    
    // New format: /share/p/{postId}/ -> keep as is (Facebook handles this format)
    const shareMatch = path.match(/\/share\/p\/([A-Za-z0-9_-]+)/);
    if (shareMatch) return `https://www.facebook.com/share/p/${shareMatch[1]}/`;
    
    // Classic format: /{pageId}/posts/{postId}/ -> keep
    const postsMatch = path.match(/\/(\d+|[A-Za-z0-9_.-]+)\/posts\/(\d+)/);
    if (postsMatch) return `https://www.facebook.com/${postsMatch[1]}/posts/${postsMatch[2]}/`;
    
    // photo fbid param
    const fbid = u.searchParams.get('fbid');
    if (path.startsWith('/photo') && fbid) return `https://www.facebook.com/photo/?fbid=${fbid}`;
    
    return u.toString();
  } catch { return raw; }
}

export function FacebookPost({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const cleanUrl = normalizeFacebookUrl(url);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const el = ref.current;
    if (!el) return;
    const ensureRoot = () => {
      if (!document.getElementById('fb-root')) {
        const root = document.createElement('div');
        root.id = 'fb-root';
        document.body.prepend(root);
      }
    };
  const parseNow = () => (window as any).FB?.XFBML?.parse?.(el);
    const load = () => {
      ensureRoot();
      if (document.getElementById('facebook-jssdk')) { parseNow(); return; }
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v18.0';
      script.async = true;
      script.onload = parseNow;
      document.body.appendChild(script);
    };
    const start = () => {
      load();
      // Retry parse a couple times in case SDK slow
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if ((window as any).FB?.XFBML) parseNow();
        // If after 5 attempts no iframe, fallback
        const hasIframe = !!el.querySelector('iframe');
        if (hasIframe || attempts >= 5) {
          if (!hasIframe) setFallback(true);
          clearInterval(interval);
        }
      }, 1200);
    };
    observer = new IntersectionObserver((entries) => {
      entries.forEach(ent => { if (ent.isIntersecting) { start(); observer?.disconnect(); } });
    }, { threshold: 0.01 });
    observer.observe(el);
    return () => observer?.disconnect();
  }, [cleanUrl]);

  if (fallback) {
    const pluginSrc = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(cleanUrl)}&show_text=true&width=500`;
    return (
      <div className="w-full">
        <iframe
          src={pluginSrc}
          style={{ border: 'none', overflow: 'hidden', width: '100%' }}
          width="100%"
          height="550"
          scrolling="no"
          frameBorder={0}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
        <div className="mt-2 text-[11px] text-slate-500 line-clamp-1">
          <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-slate-300">Abrir en Facebook ↗</a>
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} className="fb-post w-full" data-href={cleanUrl} data-width="350" data-show-text="true">
      <blockquote cite={cleanUrl} className="fb-xfbml-parse-ignore text-xs text-slate-400">Cargando publicación...</blockquote>
    </div>
  );
}
