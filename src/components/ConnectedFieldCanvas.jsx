import { useEffect, useRef } from "react";

const MAX_DPR = 1.25;
const GRID_SPACING = 96;
const CURSOR_RADIUS = 168;
const LINK_DISTANCE = 128;
const FRAME_INTERVAL = 1000 / 30;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function ConnectedFieldCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || typeof window === "undefined") {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.35,
      targetX: window.innerWidth * 0.5,
      targetY: window.innerHeight * 0.35,
      velocityX: 0,
      velocityY: 0,
      visible: false,
    };
    let points = [];
    let rafId = 0;
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let dpr = 1;
    let lastFrameTime = 0;
    let pageVisible = !document.hidden;

    function buildPoints() {
      columns = Math.max(2, Math.ceil(width / GRID_SPACING) + 2);
      rows = Math.max(2, Math.ceil(height / GRID_SPACING) + 2);
      points = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = column * GRID_SPACING - GRID_SPACING * 0.5;
          const y = row * GRID_SPACING - GRID_SPACING * 0.5;
          const seed = (row * 0.37 + column * 0.19) * Math.PI;

          points.push({
            baseX: x,
            baseY: y,
            renderX: x,
            renderY: y,
            seed,
            glow: 0,
          });
        }
      }
    }

    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildPoints();
    }

    function handlePointerMove(event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        pointer.visible = false;
        return;
      }

      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.visible = true;
    }

    function handlePointerLeave() {
      pointer.visible = false;
    }

    function handleVisibilityChange() {
      pageVisible = !document.hidden;
    }

    function drawFrame(time) {
      if (!pageVisible) {
        rafId = window.requestAnimationFrame(drawFrame);
        return;
      }

      if (time - lastFrameTime < FRAME_INTERVAL) {
        rafId = window.requestAnimationFrame(drawFrame);
        return;
      }

      lastFrameTime = time;
      pointer.velocityX += (pointer.targetX - pointer.x) * (prefersReducedMotion ? 0.08 : 0.045);
      pointer.velocityY += (pointer.targetY - pointer.y) * (prefersReducedMotion ? 0.08 : 0.045);
      pointer.velocityX *= prefersReducedMotion ? 0.76 : 0.82;
      pointer.velocityY *= prefersReducedMotion ? 0.76 : 0.82;
      pointer.x += pointer.velocityX;
      pointer.y += pointer.velocityY;

      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const driftX = prefersReducedMotion
          ? 0
          : Math.sin(time * 0.00022 + point.seed) * 6 + Math.cos(time * 0.00014 + point.seed) * 3;
        const driftY = prefersReducedMotion
          ? 0
          : Math.cos(time * 0.00018 + point.seed * 1.2) * 6 +
            Math.sin(time * 0.00011 + point.seed * 0.8) * 3;
        let renderX = point.baseX + driftX;
        let renderY = point.baseY + driftY;
        let glow = 0;

        if (pointer.visible) {
          const deltaX = pointer.x - renderX;
          const deltaY = pointer.y - renderY;
          const distance = Math.hypot(deltaX, deltaY);
          const influence = clamp(1 - distance / CURSOR_RADIUS, 0, 1);
          const directionX = distance > 0 ? deltaX / distance : 0;
          const directionY = distance > 0 ? deltaY / distance : 0;
          const push = influence * influence * 24;
          const flow = influence * 7;

          renderX -= directionX * push;
          renderY -= directionY * push;
          renderX += pointer.velocityX * flow;
          renderY += pointer.velocityY * flow;
          glow = influence;
        }

        point.renderX = renderX;
        point.renderY = renderY;
        point.glow = glow;
      }

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          const point = points[index];

          if (!point) {
            continue;
          }

          const neighborIndexes = [index + 1, index + columns, index + columns + 1];

          for (let neighborIndex = 0; neighborIndex < neighborIndexes.length; neighborIndex += 1) {
            const other = points[neighborIndexes[neighborIndex]];

            if (!other) {
              continue;
            }

            const deltaX = other.renderX - point.renderX;
            const deltaY = other.renderY - point.renderY;
            const distance = Math.hypot(deltaX, deltaY);

            if (distance > LINK_DISTANCE) {
              continue;
            }

            const glow = Math.max(point.glow, other.glow);
            const alpha = 0.026 + glow * 0.13 - distance / 1750;

            context.strokeStyle = `rgba(255, 232, 223, ${clamp(alpha, 0.018, 0.22)})`;
            context.beginPath();
            context.moveTo(point.renderX, point.renderY);
            context.lineTo(other.renderX, other.renderY);
            context.stroke();
          }
        }
      }

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const radius = 1.05 + point.glow * 1.4;
        const alpha = 0.18 + point.glow * 0.46;

        context.fillStyle = `rgba(255, 243, 236, ${clamp(alpha, 0.12, 0.82)})`;
        context.beginPath();
        context.arc(point.renderX, point.renderY, radius, 0, Math.PI * 2);
        context.fill();
      }

      rafId = window.requestAnimationFrame(drawFrame);
    }

    resizeCanvas();
    rafId = window.requestAnimationFrame(drawFrame);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="scene-backdrop__field-canvas" aria-hidden="true" />;
}
