import { useEffect, useRef, useCallback } from 'react';

const BLUE_BLOBS = 2;
const TOTAL_BLOBS = 3;

type BlobType = 'blue' | 'red';

interface Blob {
  type: BlobType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  speed: number;
  // movement params
  phase: number;
  driftX: number;
  driftY: number;
  driftSpeed: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

interface InteractiveBackgroundProps {
  repelRadius?: number;
  repelStrength?: number;
  blobScale?: number;
}

export function InteractiveBackground({
  repelRadius = 420,
  repelStrength = 900,
  blobScale = 1.6,
}: InteractiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const blobsRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);

  const initBlobs = useCallback((w: number, h: number) => {
    const readVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const hslVar = (name: string, alpha: number) => {
      const v = readVar(name);
      return v ? `hsl(${v} / ${alpha})` : `hsl(0 0% 0% / ${alpha})`;
    };

    const blueColor = hslVar('--primary', 0.35);
    const blueColorSoft = hslVar('--primary', 0.25);
    const redColor = hslVar('--destructive', 0.30);

    const makeBlue = (i: number): Blob => ({
      type: 'blue',
      x: Math.random() * w,
      y: Math.random() * h,
      targetX: w / 2,
      targetY: h / 2,
      radius: (260 + Math.random() * 240) * blobScale,
      color: i % 2 === 0 ? blueColor : blueColorSoft,
      speed: 0.012 + Math.random() * 0.018,
      phase: Math.random() * Math.PI * 2,
      driftX: (Math.random() - 0.5) * 400,
      driftY: (Math.random() - 0.5) * 400,
      driftSpeed: 0.002 + Math.random() * 0.003,
    });

    const makeRedFollower = (): Blob => ({
      type: 'red',
      x: w / 2,
      y: h / 2,
      targetX: w / 2,
      targetY: h / 2,
      radius: (220 + Math.random() * 120) * blobScale,
      color: redColor,
      speed: 0.055,
      phase: Math.random() * Math.PI * 2,
      driftX: 0,
      driftY: 0,
      driftSpeed: 0,
    });

    blobsRef.current = [
      ...Array.from({ length: BLUE_BLOBS }, (_, i) => makeBlue(i)),
      makeRedFollower(),
    ];
  }, [blobScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initBlobs(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const handlePointerMove = (clientX: number, clientY: number) => {
      pointerRef.current = { x: clientX, y: clientY, active: true };
    };

    const onPointerMove = (e: PointerEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) handlePointerMove(t.clientX, t.clientY);
    };

    // Prefer PointerEvent when available, but keep mouse/touch as fallback.
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    let time = 0;

    const drawBlob = (blob: Blob) => {
      const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
      gradient.addColorStop(0, blob.color);
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      gradient.addColorStop(1, bg ? `hsl(${bg} / 0)` : 'transparent');

      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    };

    const animate = () => {
      time += 0.009;

      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      const px = pointerRef.current.active ? pointerRef.current.x : w / 2;
      const py = pointerRef.current.active ? pointerRef.current.y : h / 2;


      for (const blob of blobsRef.current) {
        if (blob.type === 'blue') {
          // Random-ish drift around the pointer region (but not locked to it)
          blob.driftX += Math.sin(time * (0.9 + blob.driftSpeed) + blob.phase) * 0.8;
          blob.driftY += Math.cos(time * (0.8 + blob.driftSpeed) + blob.phase) * 0.8;
          blob.driftX = clamp(blob.driftX, -520, 520);
          blob.driftY = clamp(blob.driftY, -520, 520);

          const dx = blob.x - px;
          const dy = blob.y - py;
          const dist = Math.max(1, Math.hypot(dx, dy));

          if (dist < repelRadius) {
            // Repel away from the pointer
            const force = (1 - dist / repelRadius) * repelStrength;
            blob.targetX = blob.x + (dx / dist) * force;
            blob.targetY = blob.y + (dy / dist) * force;
          } else {
            // Wander in a slow, organic way (independent of the pointer)
            const wanderX = Math.sin(time + blob.phase) * 120 + blob.driftX;
            const wanderY = Math.cos(time + blob.phase) * 120 + blob.driftY;
            blob.targetX = w * 0.5 + wanderX;
            blob.targetY = h * 0.5 + wanderY;
          }
        } else {
          // Red blob follows the pointer with a soft trail + subtle orbit jitter
          const orbit = 22;
          blob.targetX = px + Math.sin(time * 2 + blob.phase) * orbit;
          blob.targetY = py + Math.cos(time * 2 + blob.phase) * orbit;
        }

        blob.x += (blob.targetX - blob.x) * blob.speed;
        blob.y += (blob.targetY - blob.y) * blob.speed;

        // Keep inside viewport (allow some bleeding outside for nicer gradients)
        const pad = Math.min(140, blob.radius * 0.22);
        blob.x = clamp(blob.x, -pad, w + pad);
        blob.y = clamp(blob.y, -pad, h + pad);

        drawBlob(blob);
      }

      if (!reduceMotion) rafRef.current = requestAnimationFrame(animate);
    };

    // First frame: render once even in reduced motion
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [initBlobs, repelRadius, repelStrength]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0"
      style={{ filter: 'blur(60px)' }}
      aria-hidden="true"
    />
  );
}
