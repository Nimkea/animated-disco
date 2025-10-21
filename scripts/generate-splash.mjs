import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPLASH_SCREENS = [
  { name: 'iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png', width: 1290, height: 2796 },
  { name: 'iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png', width: 1179, height: 2556 },
  { name: 'iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png', width: 1284, height: 2778 },
  { name: 'iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png', width: 1170, height: 2532 },
  { name: 'iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png', width: 1125, height: 2436 },
  { name: 'iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png', width: 1242, height: 2688 },
  { name: 'iPhone_11__iPhone_XR_portrait.png', width: 828, height: 1792 },
  { name: 'iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png', width: 1242, height: 2208 },
  { name: 'iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png', width: 750, height: 1334 },
  { name: '4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png', width: 640, height: 1136 },
  { name: '12.9__iPad_Pro_portrait.png', width: 2048, height: 2732 },
  { name: '11__iPad_Pro__10.5__iPad_Pro_portrait.png', width: 1668, height: 2388 },
  { name: '10.9__iPad_Air_portrait.png', width: 1640, height: 2360 },
  { name: '10.5__iPad_Air_portrait.png', width: 1668, height: 2224 },
  { name: '10.2__iPad_portrait.png', width: 1620, height: 2160 },
  { name: '9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png', width: 1536, height: 2048 },
  { name: '8.3__iPad_Mini_portrait.png', width: 1488, height: 2266 },
];

function generateStarFieldSVG(width, height, starCount = 150) {
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 2.5 + 0.5;
    const opacity = 0.3 + Math.random() * 0.7;
    stars.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="rgba(212,175,55,${opacity})" />`);
  }
  return stars.join('\n');
}

async function generateSplashScreen(config) {
  const { width, height, name } = config;
  
  const starField = generateStarFieldSVG(width, height, Math.floor(width * height / 8000));
  
  const logoSize = Math.min(width, height) * 0.25;
  const logoX = (width - logoSize) / 2;
  const logoY = (height - logoSize) / 2 - logoSize * 0.2;

  const fontSize = Math.floor(logoSize * 0.15);
  const taglineSize = Math.floor(logoSize * 0.08);
  const textY = logoY + logoSize + logoSize * 0.3;
  const taglineY = logoY + logoSize + logoSize * 0.5;

  const svgBackground = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#000000"/>
      ${starField}
      <text
        x="${width / 2}"
        y="${textY}"
        font-family="Space Grotesk, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#D4AF37"
        text-anchor="middle"
        dominant-baseline="middle">XNRT</text>
      <text
        x="${width / 2}"
        y="${taglineY}"
        font-family="Space Grotesk, Arial, sans-serif"
        font-size="${taglineSize}"
        fill="#D4AF37"
        text-anchor="middle"
        dominant-baseline="middle">We Build the NextGen</text>
    </svg>
  `;

  const logoPath = join(__dirname, '../client/public/icon-512.png');
  const logoBuffer = readFileSync(logoPath);

  const bgBuffer = Buffer.from(svgBackground);
  
  const splashBuffer = await sharp(bgBuffer)
    .composite([
      {
        input: await sharp(logoBuffer)
          .resize(Math.floor(logoSize), Math.floor(logoSize))
          .toBuffer(),
        top: Math.floor(logoY),
        left: Math.floor(logoX),
      }
    ])
    .png()
    .toBuffer();

  return splashBuffer;
}

async function main() {
  console.log('🎨 Generating iOS splash screens with XNRT cosmic theme...');
  
  const outputDir = join(__dirname, '../client/public/splash');
  mkdirSync(outputDir, { recursive: true });

  for (const config of SPLASH_SCREENS) {
    console.log(`  ✨ Generating ${config.name} (${config.width}x${config.height})...`);
    const buffer = await generateSplashScreen(config);
    const outputPath = join(outputDir, config.name);
    writeFileSync(outputPath, buffer);
  }

  console.log(`\n✅ Generated ${SPLASH_SCREENS.length} splash screens in ${outputDir}`);
  console.log('📱 Splash screens ready for iOS PWA installation!');
}

main().catch(console.error);
