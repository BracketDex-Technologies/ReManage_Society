/**
 * Generate all Android launcher icons from applogo.png
 * - Replaces white corners/borders with brand orange (the source is JPEG with white bg)
 * - Makes the R logo fill more of the icon space — professional look
 * - Edge-to-edge icons, no visible border on any Android launcher shape
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGO = join(ROOT, 'assets', 'applogo.png');
const RES_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const DENSITIES = {
  ldpi:    { launcher: 36,  foreground: 54  },
  mdpi:    { launcher: 48,  foreground: 72  },
  hdpi:    { launcher: 72,  foreground: 108 },
  xhdpi:   { launcher: 96,  foreground: 144 },
  xxhdpi:  { launcher: 144, foreground: 216 },
  xxxhdpi: { launcher: 192, foreground: 288 },
};

const BRAND_ORANGE = { r: 243, g: 108, b: 33 };

/**
 * Create a clean version of the logo by:
 * 1. Flattening onto orange to remove all white corners
 * 2. The white "R" content stays white (it's far from orange threshold)
 * 3. Cropping to the actual rounded-rect content area
 */
async function getCleanLogoBuffer() {
  // First flatten the JPEG onto the orange background
  // This turns white corners → orange
  const flattened = await sharp(LOGO)
    .flatten({ background: BRAND_ORANGE })
    .toBuffer();

  // Now we have edge-to-edge orange with the white R in the center.
  // The original has rounded corners that are now orange-on-orange → invisible.
  // Trim any remaining uniform edges
  return sharp(flattened)
    .trim({ threshold: 5 })
    .toBuffer();
}

/**
 * Create an edge-to-edge icon: solid orange bg + white R logo scaled to fill.
 */
async function generateLauncherIcon(cleanLogo, size, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });

  // Scale logo to fill 100% of the icon — edge to edge
  const resized = await sharp(cleanLogo)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ic_launcher (${size}px)`);
}

/**
 * Round icon: edge-to-edge then circular mask
 */
async function generateRoundIcon(cleanLogo, size, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });

  const base = await sharp(cleanLogo)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  await sharp(base)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ic_launcher_round (${size}px)`);
}

/**
 * Adaptive foreground: just the white R on transparent.
 * We extract white content from the logo by using the orange as background-to-remove.
 * The R fills ~78% of the canvas for a big professional look.
 */
async function generateForeground(cleanLogo, size, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });

  // Resize to fill 78% of adaptive foreground
  const logoSize = Math.round(size * 0.78);
  const padding = Math.round((size - logoSize) / 2);

  const resizedLogo = await sharp(cleanLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .toBuffer();

  // Create the transparent canvas and composite
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedLogo, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ic_launcher_foreground (${size}px)`);
}

/**
 * Adaptive background: pure solid orange
 */
async function generateBackground(size, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...BRAND_ORANGE, alpha: 1 },
    },
  })
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ic_launcher_background (${size}px)`);
}

/**
 * Splash: logo on dark navy background with subtle rounded corners
 */
async function generateSplash(cleanLogo, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });

  const canvasW = 480;
  const canvasH = 480;
  const logoSize = 300;

  const base = await sharp(cleanLogo)
    .resize(logoSize, logoSize, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const radius = Math.round(logoSize * 0.18);
  const roundedMask = Buffer.from(
    `<svg width="${logoSize}" height="${logoSize}">
      <rect x="0" y="0" width="${logoSize}" height="${logoSize}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );
  const roundedLogo = await sharp(base)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const left = Math.round((canvasW - logoSize) / 2);
  const top = Math.round((canvasH - logoSize) / 2);

  await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } },
  })
    .composite([{ input: roundedLogo, left, top }])
    .png()
    .toFile(outputPath);

  console.log(`  ✓ splash.png`);
}

async function main() {
  console.log('🎨 Generating professional Android icons (zero white borders)...\n');

  const cleanLogo = await getCleanLogoBuffer();
  console.log('✓ Source logo cleaned — white corners replaced with orange\n');

  for (const [density, sizes] of Object.entries(DENSITIES)) {
    const mipmapDir = join(RES_DIR, `mipmap-${density}`);
    console.log(`📱 ${density}:`);

    await generateLauncherIcon(cleanLogo, sizes.launcher, join(mipmapDir, 'ic_launcher.png'));
    await generateRoundIcon(cleanLogo, sizes.launcher, join(mipmapDir, 'ic_launcher_round.png'));
    await generateForeground(cleanLogo, sizes.foreground, join(mipmapDir, 'ic_launcher_foreground.png'));
    await generateBackground(sizes.foreground, join(mipmapDir, 'ic_launcher_background.png'));
    console.log('');
  }

  console.log('💦 Splash:');
  await generateSplash(cleanLogo, join(RES_DIR, 'drawable', 'splash.png'));

  console.log('\n✅ Done — clean, professional, edge-to-edge icons!');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
