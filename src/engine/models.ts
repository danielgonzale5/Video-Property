// Model facts shared by the generator and the (network-free) planner.
// Checked against docs.dev.runwayml.com/openapi.json and /guides/pricing on 2026-09-25.

// Models that accept a last frame as well as a first one.
const LAST_FRAME_MODELS = new Set([
	'veo3.1', 'veo3.1_fast', 'seedance2', 'seedance2_fast', 'seedance2_mini', 'seedance2_5', 'h3_max',
]);
export const supportsLastFrame = (model: string) => LAST_FRAME_MODELS.has(model);

export const modelFor = (premium: boolean) =>
	premium ? process.env.RUNWAY_PREMIUM_MODEL || 'gen4.5' : process.env.RUNWAY_MODEL || 'gen4_turbo';

// Seconds we request per clip: Veo only takes 4, 6 or 8.
export const clipSecondsFor = (model: string) => (model.startsWith('veo') ? 4 : 5);

// Credits per second of output with audio off ($0.01 per credit).
const RATE: Record<string, number> = {
	gen4_turbo: 5,
	'gen4.5': 12,
	'veo3.1_fast': 10,
	'veo3.1': 20,
	seedance2_mini: 16,
	seedance2_fast: 29,
	seedance2: 36,
};
const MINIMUM: Record<string, number> = {seedance2_mini: 64};

export const creditsFor = (model: string) => {
	const rate = RATE[model];
	if (rate === undefined) return NaN;
	return Math.max(rate * clipSecondsFor(model), MINIMUM[model] ?? 0);
};
