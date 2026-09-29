// Fills jobs/demo/photos with gradient stand-ins so the pipeline runs before real photos exist.
// Usage: npm run placeholders
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const dir = path.resolve('jobs/demo/photos');
fs.mkdirSync(dir, {recursive: true});

const shots: [string, string, string][] = [
	['01-hero.jpg', '0x1e3a5f', '0xd8b477'],
	['02-living.jpg', '0x6b4f3a', '0xe9dcc9'],
	['03-bedroom.jpg', '0x3b3355', '0xcbb8d9'],
	['04-pool.jpg', '0x0a6e8a', '0x7fd6e8'],
	['05-view.jpg', '0x14324f', '0xf2a65a'],
	['06-kitchen.jpg', '0x444444', '0xdedede'],
	['07-exterior.jpg', '0x2f4f2f', '0xb7d3a8'],
];

for (const [name, c0, c1] of shots) {
	const out = path.join(dir, name);
	if (fs.existsSync(out)) continue; // never overwrite a real photo
	execFileSync('ffmpeg', [
		'-y', '-loglevel', 'error',
		'-f', 'lavfi', '-i', `gradients=s=1600x1600:c0=${c0}:c1=${c1}:n=2:speed=0`,
		'-frames:v', '1', '-q:v', '3', out,
	]);
	console.log('created', path.relative(process.cwd(), out));
}
