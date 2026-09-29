// Runway image-to-video. One photo in, one short clip out.
// API reference: https://docs.dev.runwayml.com/
import fs from 'node:fs';
import path from 'node:path';
import type {AspectRatio} from './types';
import {clipSecondsFor, modelFor, supportsLastFrame} from './models';
import {NEGATIVE, fullPrompt, prepareFrame, ratioFor, taskFileFor, uploadFileFor} from './prep';

const API = 'https://api.dev.runwayml.com/v1';
const VERSION = '2024-11-06';
const POLL_LIMIT_MS = 15 * 60 * 1000;

export const runwayEnabled = () => Boolean(process.env.RUNWAY_API_KEY);

const headers = () => ({
	Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
	'X-Runway-Version': VERSION,
	'Content-Type': 'application/json',
});

const toDataUri = (photo: string, tmpDir: string, ratio: string) => {
	const file = prepareFrame(photo, uploadFileFor(photo, tmpDir), ratio);
	return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
};

async function waitAndDownload(id: string, outFile: string) {
	const started = Date.now();
	for (;;) {
		await new Promise((r) => setTimeout(r, 5000));
		const t = await fetch(`${API}/tasks/${id}`, {headers: headers()});
		if (!t.ok) throw new Error(`Runway task ${id} ${t.status}: ${await t.text()}`);
		const task = (await t.json()) as {status: string; output?: string[]; failure?: string};
		if (task.status === 'SUCCEEDED' && task.output?.[0]) {
			const video = await fetch(task.output[0]);
			fs.writeFileSync(outFile, Buffer.from(await video.arrayBuffer()));
			fs.rmSync(taskFileFor(outFile), {force: true});
			return;
		}
		if (task.status === 'FAILED' || task.status === 'CANCELLED') {
			fs.rmSync(taskFileFor(outFile), {force: true});
			throw new Error(`Runway task ${id} ${task.status}: ${task.failure ?? 'no reason given'}`);
		}
		if (Date.now() - started > POLL_LIMIT_MS) {
			// Keep the task file: the next run resumes this task, it never pays for a new one.
			throw new Error(`Runway task ${id} still ${task.status} after 15 min; re-run later to collect it`);
		}
	}
}

// Collects a clip whose task was already paid for. Returns false when there is nothing pending.
export async function resumePending(outFile: string): Promise<boolean> {
	const file = taskFileFor(outFile);
	if (!fs.existsSync(file)) return false;
	const {id} = JSON.parse(fs.readFileSync(file, 'utf8')) as {id: string};
	console.log(`runway: resuming paid task ${id}`);
	await waitAndDownload(id, outFile);
	return true;
}

export async function imageToVideo(opts: {
	photo: string;
	nextPhoto?: string; // used as the last frame when the model supports it
	prompt: string;
	format: AspectRatio;
	premium: boolean;
	outFile: string;
}): Promise<string> {
	const model = modelFor(opts.premium);
	if (await resumePending(opts.outFile)) return model;

	const tmp = path.dirname(opts.outFile);
	const veo = model.startsWith('veo');
	const ratio = ratioFor(model, opts.format);
	const first = toDataUri(opts.photo, tmp, ratio);
	const promptImage =
		opts.nextPhoto && supportsLastFrame(model)
			? [
					{uri: first, position: 'first'},
					{uri: toDataUri(opts.nextPhoto, tmp, ratio), position: 'last'},
				]
			: first;

	const res = await fetch(`${API}/image_to_video`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({
			model,
			promptImage,
			promptText: fullPrompt(opts.prompt).slice(0, 1000),
			ratio,
			duration: clipSecondsFor(model),
			// Both default to generated audio, which Veo bills at double; music comes from Remotion.
			...(veo || model.startsWith('seedance') ? {audio: false} : {}),
			...(veo ? {negativePrompt: NEGATIVE} : {}),
		}),
	});
	if (!res.ok) throw new Error(`Runway ${res.status}: ${await res.text()}`);
	const {id} = (await res.json()) as {id: string};
	fs.writeFileSync(taskFileFor(opts.outFile), JSON.stringify({id, model, at: new Date().toISOString()}));
	console.log(`runway: task ${id} accepted (${model})`);

	await waitAndDownload(id, opts.outFile);
	return model;
}
