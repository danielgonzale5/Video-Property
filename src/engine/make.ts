// Turns a job folder into a finished video.
//
//   npm run make -- jobs/demo                 full 25s video, stills animated in Remotion
//   npm run make -- jobs/demo --preview       5-8s watermarked preview
//   npm run make -- jobs/demo --format 16:9   override the job's aspect ratio
//   npm run plan -- jobs/demo                 what --runway would do and cost (no network)
//   npm run make -- jobs/demo --runway --approve <credits>
//                                             generate missing clips first; <credits> must equal the plan
//
// Output lands in jobs/<id>/out/.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {imageToVideo, runwayEnabled} from './runway';
import {clipFileFor, endPhotoFor, loadJob, usesRunway} from './job';
import {creditsFor, modelFor} from './models';
import {taskFileFor} from './prep';
import type {PropertyVideoProps, RenderScene} from './types';

try {
	process.loadEnvFile('.env');
} catch {
	// no .env yet: demo mode
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

const target = args.find((a) => !a.startsWith('--') && a !== option('format'));
if (!target) {
	console.error('usage: npm run make -- <job folder> [--preview] [--format 9:16|16:9|1:1] [--runway]');
	process.exit(1);
}

const {job, jobDir, format} = loadJob(target, option('format'));
const preview = flag('preview');

const outDir = path.join(jobDir, 'out');
const clipDir = path.join(jobDir, 'clips');
fs.mkdirSync(outDir, {recursive: true});
fs.mkdirSync(clipDir, {recursive: true});

const probeSeconds = (file: string) =>
	Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

const rel = (p: string) => path.relative(jobDir, p).split(path.sep).join('/');
const exists = (p: string | null | undefined) => Boolean(p && fs.existsSync(path.join(jobDir, p)));

// ---- scenes --------------------------------------------------------------
// Each scene keeps its index in the full job, so its last frame (and clip file) is the same in
// a preview as in the final video: a preview never asks Runway for a different clip.
let picked = job.scenes.map((s, i) => ({s, i}));
if (preview) {
	// Hero, one interior, the closing shot. 2.5s each, about 7.5s total.
	picked = [picked[0], picked[1], picked[picked.length - 1]].map(({s, i}) => ({s: {...s, seconds: 2.5}, i}));
}

for (const {s} of picked) {
	if (!exists(s.photo)) throw new Error(`missing photo ${s.photo} (run "npm run placeholders" for the demo)`);
}

const useRunway = flag('runway');
if (useRunway) {
	if (preview) throw new Error('--runway is not allowed with --preview: generate with the full job, then preview');
	if (!runwayEnabled()) throw new Error('--runway needs RUNWAY_API_KEY in .env');
	// Spend guard: the caller must state the exact credit total that `npm run plan` printed.
	const planned = picked.reduce((sum, {s, i}) => {
		if (!usesRunway(s)) return sum;
		const clip = clipFileFor(jobDir, s, format, endPhotoFor(job, i));
		return sum + (fs.existsSync(clip) || fs.existsSync(taskFileFor(clip)) ? 0 : creditsFor(modelFor(Boolean(s.premium))));
	}, 0);
	const approved = Number(option('approve'));
	if (approved !== planned) {
		console.error(`--runway would spend ${planned} credits. Run "npm run plan" first, then add --approve ${planned}.`);
		process.exit(1);
	}
}

const scenes: RenderScene[] = [];
for (const {s, i} of picked) {
	const endPhoto = endPhotoFor(job, i);
	const clip = clipFileFor(jobDir, s, format, endPhoto);
	if (!fs.existsSync(clip) && useRunway && usesRunway(s)) {
		console.log(`runway: ${s.photo} -> ${endPhoto ?? '(no last frame)'}`);
		const model = await imageToVideo({
			photo: path.join(jobDir, s.photo),
			// In a walkthrough each clip ends on the next room, so the cut becomes a camera move.
			nextPhoto: endPhoto ? path.join(jobDir, endPhoto) : undefined,
			prompt: s.motion_prompt || 'Subtle cinematic slow forward dolly movement.',
			format,
			premium: Boolean(s.premium),
			outFile: clip,
		});
		console.log(`runway: ${s.photo} done with ${model}`);
	}
	// A clip generated earlier is reused, so re-rendering never re-spends credits.
	const hasClip = fs.existsSync(clip);
	scenes.push({
		src: hasClip ? rel(clip) : s.photo,
		kind: hasClip ? 'video' : 'image',
		role: s.role,
		seconds: s.seconds,
		caption: s.caption ?? null,
		clipSeconds: hasClip ? probeSeconds(clip) : undefined,
	});
}

// ---- music ---------------------------------------------------------------
let music: string | null = null;
if (job.music_category) {
	const dir = path.resolve('assets/music', job.music_category);
	const track = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /\.(mp3|wav|m4a|aac)$/i.test(f)) : undefined;
	if (track) {
		const dest = path.join(jobDir, `_music${path.extname(track)}`);
		fs.copyFileSync(path.join(dir, track), dest);
		music = rel(dest);
		console.log(`music: ${job.music_category}/${track}`);
	} else {
		console.warn(`music: no track in assets/music/${job.music_category}, rendering without music`);
	}
}

if (job.logo && !exists(job.logo)) console.warn(`logo: ${job.logo} not found, rendering without logo`);

const inputProps: PropertyVideoProps = {
	propertyName: job.property_name,
	location: job.location,
	cta: job.cta,
	ctaSub: job.cta_sub ?? null,
	logo: exists(job.logo) ? job.logo! : null,
	music,
	aspectRatio: format,
	watermark: preview ? 'PREVIEW' : null,
	walkthrough: job.style === 'walkthrough',
	showText: job.text !== false,
	scenes,
};

// ---- render --------------------------------------------------------------
const name = `${preview ? 'preview' : 'final'}_${format.replace(':', 'x')}`;
const raw = path.join(outDir, `${name}.raw.mp4`);
const final = path.join(outDir, `${name}.mp4`);

console.log('bundling...');
const serveUrl = await bundle({entryPoint: path.resolve('src/remotion/index.ts'), publicDir: jobDir});
const composition = await selectComposition({serveUrl, id: 'PropertyVideo', inputProps});

let lastPct = -1;
await renderMedia({
	composition,
	serveUrl,
	codec: 'h264',
	outputLocation: raw,
	inputProps,
	onProgress: ({progress}) => {
		const pct = Math.floor(progress * 10) * 10;
		if (pct !== lastPct) console.log(`render ${pct}%`), (lastPct = pct);
	},
});

// ---- post (FFmpeg) -------------------------------------------------------
const ff = (a: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
if (music) {
	// Social platforms normalise to about -14 LUFS; true peak under -1.5 dB avoids clipping.
	ff(['-i', raw, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', final]);
	fs.rmSync(raw);
} else {
	fs.renameSync(raw, final);
}
ff(['-ss', '1.5', '-i', final, '-frames:v', '1', '-q:v', '2', path.join(outDir, `${name}_thumbnail.jpg`)]);

const probe = JSON.parse(
	execFileSync('ffprobe', [
		'-v', 'error', '-select_streams', 'v:0',
		'-show_entries', 'stream=width,height:format=duration', '-of', 'json', final,
	]).toString(),
) as {streams: {width: number; height: number}[]; format: {duration: string}};
const {width, height} = probe.streams[0];
console.log(`done: ${path.relative(process.cwd(), final)}  (${width}x${height}, ${Number(probe.format.duration).toFixed(1)}s)`);
