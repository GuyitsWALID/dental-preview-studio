import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const targets = [
  ['plus-jakarta-sans', 'jakarta'], ['manrope', 'manrope'], ['ibm-plex-sans', 'plex']
];
await mkdir('public/studio-fonts', { recursive: true });
for (const [family, target] of targets) {
  const dir = path.join('node_modules', '@fontsource', family);
  const files = await readdir(path.join(dir, 'files'));
  for (const weight of [400,700]) {
    const font = files.find(f => f === `${family}-latin-${weight}-normal.woff2`);
    if (!font) throw new Error(`Missing local font: ${family} ${weight}`);
    await copyFile(path.join(dir, 'files', font), `public/studio-fonts/${target}${weight===400?'':'-bold'}.woff2`);
  }
  await copyFile(path.join(dir, 'LICENSE'), `public/studio-fonts/${target}-LICENSE.txt`);
}
await writeFile('public/studio-fonts/README.txt', 'Local open-source fonts. Individual licenses are included.');
