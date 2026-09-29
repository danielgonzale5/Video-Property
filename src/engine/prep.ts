// Everything about a Runway request that does not touch the network.
// Shared by runway.ts (which sends) and plan.ts (which only shows), so the audit matches the real request.
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import type {AspectRatio} from './types';

export const RATIO: Record<AspectRatio, string> = {
	'9:16': '720:1280',
	'16:9': '1280:720',
	'1:1': '960:960',
};

// Veo has no square output; Remotion crops the portrait clip instead.
export const ratioFor = (model: string, format: AspectRatio) =>
	model.startsWith('veo') && format === '1:1' ? RATIO['9:16'] : RATIO[format];

// Appended to every prompt: the clip must show the real property, not an improved one.
export const PRESERVE =
	'Preserve the exact architecture, furniture, walls and proportions. Do not add objects. ' +
	'Do not change the furniture. Do not distort windows or doors. Natural realistic lighting. ' +
	'Premium real-estate commercial style.';

export const NEGATIVE = 'added furniture, extra rooms, people, warped walls, distorted windows, text, watermark';

export const fullPrompt = (prompt: string) => `${prompt.trim()} ${PRESERVE}`;

// Center-crop to the output ratio first: Veo letterboxes a 3:4 photo inside a 9:16 frame
// (black bars, seen 2026-09-25) instead of filling it. Then scale to the output size.
export const prepareFrame = (photo: string, outFile: string, ratio: string) => {
	const [w, h] = ratio.split(':').map(Number);
	const crop = `crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})'`;
	execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', photo, '-vf', `${crop},scale=${w}:${h}`, '-q:v', '3', outFile]);
	return outFile;
};

// A paid task's id is written next to the clip the moment Runway accepts it, so an interrupted
// run can collect the clip it already paid for instead of paying again.
export const taskFileFor = (clipFile: string) => `${clipFile}.task.json`;

export const uploadFileFor = (photo: string, tmpDir: string) => path.join(tmpDir, `${path.parse(photo).name}.upload.jpg`);
