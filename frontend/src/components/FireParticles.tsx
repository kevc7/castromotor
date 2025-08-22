'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface FireParticlesProps {
  particleCount?: number;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export default function FireParticles({ 
  particleCount = 50, 
  intensity = 'low',
  className = '' 
}: FireParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuración basada en intensidad (ajustada para ser más visible)
    const intensityConfig = {
      low: { 
        particleCount: Math.min(particleCount, 35), 
        speed: 0.3, 
        alpha: 0.7,
        spawnRate: 0.4
      },
      medium: { 
        particleCount: Math.min(particleCount, 50), 
        speed: 0.5, 
        alpha: 0.8,
        spawnRate: 0.6
      },
      high: { 
        particleCount: Math.min(particleCount, 80), 
        speed: 0.7, 
        alpha: 0.9,
        spawnRate: 0.8
      }
    };

    const config = intensityConfig[intensity];

    // Redimensionar canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Crear partícula con validaciones
    const createParticle = (): Particle => {
      const maxLife = Math.max(50, 100 + Math.random() * 100); // Asegurar vida mínima
      return {
        x: Math.max(0, Math.min(canvas.width, Math.random() * canvas.width)),
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * config.speed,
        vy: -Math.max(0.1, Math.random() * 2 * config.speed + 0.5), // Asegurar velocidad hacia arriba
        life: maxLife,
        maxLife,
        size: Math.max(0.5, Math.random() * 3 + 1), // Asegurar tamaño mínimo
        hue: Math.max(0, Math.min(60, Math.random() * 60)) // Rango de fuego válido: rojo a amarillo
      };
    };

    // Inicializar partículas
    particlesRef.current = Array.from({ length: config.particleCount }, createParticle);

    // Función de animación con manejo de errores
    const animate = () => {
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Actualizar y dibujar partículas
        particlesRef.current.forEach((particle, index) => {
          try {
        // Actualizar posición
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;

        // Aplicar física sutil (viento ligero)
        particle.vx += (Math.random() - 0.5) * 0.01;
        particle.vy += Math.random() * 0.01;

        // Calcular propiedades visuales basadas en vida
        const lifeRatio = particle.life / particle.maxLife;
        const alpha = lifeRatio * config.alpha;
        const size = Math.max(0.1, particle.size * Math.min(lifeRatio * 2, 1)); // Asegurar size mínimo

        // Solo dibujar si la partícula es visible
        if (alpha <= 0.01 || size <= 0.1) {
          return; // Skip esta partícula si es demasiado pequeña o transparente
        }

        // Color de fuego dinámico
        const hue = Math.max(0, Math.min(60, particle.hue + (1 - lifeRatio) * 20)); // Clamp hue
        const saturation = 100;
        const lightness = Math.max(10, Math.min(100, 50 + (1 - lifeRatio) * 30)); // Clamp lightness

        // Dibujar partícula con validaciones
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        
        // Crear gradiente radial para efecto de brillo con validaciones
        const radius = Math.max(0.5, size * 2); // Asegurar radio mínimo positivo
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, radius
        );
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, ${Math.max(0, alpha)})`);
        gradient.addColorStop(0.5, `hsla(${hue}, ${saturation}%, ${lightness * 0.8}%, ${Math.max(0, alpha * 0.6)})`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness * 0.6}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Regenerar partícula si murió o salió de pantalla
        if (particle.life <= 0 || particle.y < -10 || particle.x < -10 || particle.x > canvas.width + 10) {
          // Solo regenerar ocasionalmente para efecto más natural
          if (Math.random() < config.spawnRate) {
            particlesRef.current[index] = createParticle();
          }
        }
          } catch (particleError) {
            // Si hay error con una partícula específica, regenerarla
            console.warn('Error rendering particle, regenerating:', particleError);
            particlesRef.current[index] = createParticle();
          }
        });

        animationRef.current = requestAnimationFrame(animate);
      } catch (animationError) {
        // Si hay error en la animación, intentar continuar después de un delay
        console.warn('Animation error, retrying in 100ms:', animationError);
        setTimeout(() => {
          if (animationRef.current) {
            animationRef.current = requestAnimationFrame(animate);
          }
        }, 100);
      }
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [particleCount, intensity]);

  return (
    <div className="fire-particles-container">
      {/* Gradient de fondo sutil */}
      <div className="fire-background-gradient" />
      
      {/* Resplandor ambiental */}
      <div className="fire-ambient-glow" />
      
      {/* Canvas principal de partículas */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 pointer-events-none ${className}`}
        style={{
          mixBlendMode: 'screen',
          opacity: intensity === 'low' ? 0.6 : intensity === 'medium' ? 0.8 : 0.9
        }}
      />
    </div>
  );
}
