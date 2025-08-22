"use client";
import React, { useEffect, useRef, useState } from 'react';

export function InstagramPost({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const el = ref.current;
    if (!el) return;
    
    const load = () => {
      // Timeout para fallback si no carga en 1 minuto
      timeoutId = setTimeout(() => {
        setFallback(true);
        setLoading(false);
      }, 60000);
      
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process();
        // Verificar si se cargó después de un tiempo
        setTimeout(() => {
          const hasEmbed = el.querySelector('iframe') || el.querySelector('.instagram-media-rendered');
          if (!hasEmbed) {
            setFallback(true);
          }
          setLoading(false);
          if (timeoutId) clearTimeout(timeoutId);
        }, 5000);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        (window as any).instgrm?.Embeds?.process();
        // Verificar si se cargó después de un tiempo
        setTimeout(() => {
          const hasEmbed = el.querySelector('iframe') || el.querySelector('.instagram-media-rendered');
          if (!hasEmbed) {
            setFallback(true);
          }
          setLoading(false);
          if (timeoutId) clearTimeout(timeoutId);
        }, 5000);
      };
      script.onerror = () => {
        setFallback(true);
        setLoading(false);
        if (timeoutId) clearTimeout(timeoutId);
      };
      document.body.appendChild(script);
    };
    
    observer = new IntersectionObserver((entries) => {
      entries.forEach(ent => { 
        if (ent.isIntersecting) { 
          load(); 
          observer?.disconnect(); 
        } 
      });
    }, { threshold: 0.1 });
    observer.observe(el);
    
    return () => {
      observer?.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [url]);

  // Extraer información de la URL para la vista previa
  const getPostInfo = () => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const username = pathParts[1];
      const postCode = pathParts[3];
      return { username, postCode };
    } catch {
      return { username: 'Instagram', postCode: '' };
    }
  };

  const { username, postCode } = getPostInfo();

  // Fallback: mostrar enlace directo con diseño atractivo
  if (fallback) {
    return (
      <div className="w-full max-w-sm mx-auto bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {/* Header con logo de Instagram */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-semibold">@{username}</div>
              <div className="text-white/80 text-sm">Publicación de Instagram</div>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4">
          <div className="text-sm text-slate-300 mb-3">
            📸 Esta publicación no puede mostrarse embebida
          </div>
          
          <div className="text-xs text-slate-400 mb-4 space-y-1">
            <div>• La cuenta puede ser privada</div>
            <div>• Restricciones de Instagram para embeds</div>
            <div>• Limitaciones del dominio actual</div>
          </div>

          {postCode && (
            <div className="text-xs text-slate-500 mb-3 font-mono bg-black/30 rounded px-2 py-1">
              Post: {postCode}
            </div>
          )}
          
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full text-center py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-medium rounded-lg transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Ver en Instagram
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
          </a>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <div className="text-xs text-slate-500 text-center">
            Haz clic para ver la publicación completa
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full">
      <blockquote 
        className="instagram-media" 
        data-instgrm-permalink={url} 
        data-instgrm-version="14" 
        style={{ background:'#0f1725', border:0, margin:0, padding:0, width:'100%' }}
      >
        <div className="text-xs text-slate-400 p-4 text-center">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Cargando publicación de Instagram...
            </div>
          ) : (
            'Publicación de Instagram'
          )}
        </div>
      </blockquote>
    </div>
  );
}
