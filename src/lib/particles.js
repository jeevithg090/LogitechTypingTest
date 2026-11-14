/**
 * Lightweight decorative particle animation on a full-screen canvas.
 * Disabled when the user prefers reduced motion.
 * @param {HTMLCanvasElement} canvas
 * @param {number} [count]
 */
export function startParticles(canvas, count = 80) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();

  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 3 + 1,
    alpha: Math.random() * 0.3 + 0.1,
    speedX: Math.random() - 0.5,
    speedY: Math.random() - 0.5,
  }));

  let frame = 0;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.fill();
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
      if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
    }
    frame = requestAnimationFrame(draw);
  };
  draw();
  window.addEventListener('resize', resize);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
  };
}
