// Reading a job and the per-scene decisions both `make` and `plan` rely on.
import fs from 'node:fs';
import path from 'node:path';
import {DIMENSIONS, type AspectRatio, type Job, type JobScene} from './types';

export function loadJob(target: string, formatOverride?: string) {
	const jobDir = path.resolve(target.endsWith('.json') ? path.dirname(target) : target);
	// Strip a BOM: Windows editors and PowerShell often add one.
	const raw = fs.readFileSync(path.join(jobDir, 'input.json'), 'utf8').replace(/^﻿/, '');
	const job = JSON.parse(raw) as Job;
	const format = (formatOverride ?? job.format) as AspectRatio;
	if (!DIMENSIONS[format]) throw new Error(`unknown format ${format}`);
	return {job, jobDir, format};
}

export const usesRunway = (s: JobScene) => s.ai !== false;

// Last frame for scene i: explicit end_photo wins (null = none); walkthroughs default to the next photo.
export function endPhotoFor(job: Job, i: number): string | undefined {
	const s = job.scenes[i];
	if (s.end_photo !== undefined) return s.end_photo ?? undefined;
	return job.style === 'walkthrough' ? job.scenes[i + 1]?.photo : undefined;
}

// The clip name includes its last frame, so changing the route never reuses a clip that ends elsewhere.
export function clipFileFor(jobDir: string, s: JobScene, format: AspectRatio, end?: string) {
	const tail = end ? `-to-${path.parse(end).name}` : '';
	return path.join(jobDir, 'clips', `${path.parse(s.photo).name}${tail}.${format.replace(':', 'x')}.mp4`);
}
