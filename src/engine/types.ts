// Shared shapes between the job file (jobs/<id>/input.json), the engine and the Remotion composition.

export type AspectRatio = '9:16' | '16:9' | '1:1';

export const DIMENSIONS: Record<AspectRatio, {width: number; height: number}> = {
	'9:16': {width: 1080, height: 1920},
	'16:9': {width: 1920, height: 1080},
	'1:1': {width: 1080, height: 1080},
};

export type SceneRole =
	| 'hero'
	| 'living_room'
	| 'bedroom'
	| 'kitchen'
	| 'bathroom'
	| 'pool'
	| 'balcony'
	| 'view'
	| 'exterior'
	| 'other'
	| 'cta';

// One scene as written in input.json (the storyboard).
export type JobScene = {
	photo: string; // relative to the job folder, e.g. "photos/01-hero.jpg"
	role: SceneRole;
	seconds: number;
	caption?: string | null; // short on-screen text, keep it to a few words
	motion_prompt?: string; // Runway prompt for this photo
	// Last frame for the Runway clip. Walkthroughs default to the next scene's photo;
	// null means no last frame (the scene change is a fade, not a camera move).
	end_photo?: string | null;
	ai?: boolean; // false: never sent to Runway, the still is animated in Remotion for free
	premium?: boolean; // use the premium Runway model for this one
};

export type Job = {
	property_name: string;
	location: string;
	format: AspectRatio;
	style: string;
	logo?: string | null;
	music_category?: string | null;
	cta: string;
	cta_sub?: string | null; // e.g. booking link or @instagram
	text?: boolean; // false: no title, captions or CTA, only the footage
	scenes: JobScene[];
};

// What the Remotion composition receives.
export type RenderScene = {
	src: string; // path inside the bundle's public dir
	kind: 'image' | 'video';
	role: SceneRole;
	seconds: number;
	caption: string | null;
	clipSeconds?: number; // length of the Runway clip; it is sped up or slowed to fill the scene
};

export type PropertyVideoProps = {
	propertyName: string;
	location: string;
	cta: string;
	ctaSub: string | null;
	logo: string | null;
	music: string | null;
	aspectRatio: AspectRatio;
	watermark: string | null;
	walkthrough: boolean; // every still pushes forward, like walking through the property
	showText: boolean;
	scenes: RenderScene[];
};
