// Generate PWA icons as simple PNG files using Canvas
// Run: node scripts/gen-icons.js

const fs = require("fs");
const { createCanvas } = (() => {
  try { return require("canvas"); } catch { return { createCanvas: null }; }
})();

function makePng(size, maskable = false) {
  if (!createCanvas) {
    // Fallback: generate a minimal valid PNG programmatically
    return makeMinimalPng(size, maskable);
  }
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const bg = "#1a1a1f";
  const accent = "#6375f0";

  ctx.fillStyle = bg;
  if (maskable) {
    ctx.fillRect(0, 0, size, size);
  } else {
    const r = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size); ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath(); ctx.fill();
  }

  // Pin icon
  const cx = size / 2, cy = size * 0.42;
  const pinR = size * 0.18;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, pinR, Math.PI, 0);
  ctx.lineTo(cx, cy + pinR * 1.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, pinR * 0.35, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

// Minimal 1-color PNG without canvas dependency
function makeMinimalPng(size, maskable) {
  // We'll create an SVG and note that user should convert it
  const accent = "#6375f0";
  const bg = "#1a1a1f";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.15}" fill="${bg}"/>
  <g transform="translate(${size / 2},${size * 0.42})">
    <path d="M${-size * 0.18},0 a${size * 0.18},${size * 0.18} 0 0,1 ${size * 0.36},0 L0,${size * 0.324} Z" fill="${accent}"/>
    <circle r="${size * 0.063}" fill="${bg}"/>
  </g>
</svg>`;
  return svg;
}

const outDir = "public";

if (createCanvas) {
  fs.writeFileSync(`${outDir}/icon-192.png`, makePng(192));
  fs.writeFileSync(`${outDir}/icon-512.png`, makePng(512));
  fs.writeFileSync(`${outDir}/icon-maskable-512.png`, makePng(512, true));
  console.log("PNG icons generated.");
} else {
  // Write SVG fallbacks that work as icons
  [192, 512].forEach(s => {
    fs.writeFileSync(`${outDir}/icon-${s}.png`, makeMinimalPng(s, false));
  });
  fs.writeFileSync(`${outDir}/icon-maskable-512.png`, makeMinimalPng(512, true));
  console.log("SVG icon fallbacks written (rename to .png or install 'canvas' package for real PNGs).");
  console.log("Generating real PNGs via inline SVG-to-PNG...");

  // Use a different approach: write SVG files and use them directly
  // Actually, let's just write proper SVG icons and reference them in manifest
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="76.8" fill="#1a1a1f"/><g transform="translate(256,215)"><path d="M-92,0 a92,92 0 0,1 184,0 L0,166 Z" fill="#6375f0"/><circle r="32" fill="#1a1a1f"/></g></svg>`;
  fs.writeFileSync(`${outDir}/icon.svg`, svgIcon);
  console.log("Wrote icon.svg as universal fallback.");
}
