import React from 'react';
import {
	AbsoluteFill,
	Audio,
	Img,
	OffthreadVideo,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
	Easing,
} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {loadFont as loadSerif} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadSans} from '@remotion/google-fonts/Montserrat';
import type {PropertyVideoProps, RenderScene} from '../engine/types';

const {fontFamily: serif} = loadSerif('normal', {weights: ['600'], subsets: ['latin']});
const {fontFamily: sans} = loadSans('normal', {weights: ['400', '600'], subsets: ['latin']});

export const FPS = 30;
export const TRANSITION_FRAMES = 12;

// Each non-final scene is stretched by the transition overlap so the total length
// equals the sum of the storyboard seconds.
export const sceneFrames = (scenes: RenderScene[], i: number) =>
	Math.round(scenes[i].seconds * FPS) + (i < scenes.length - 1 ? TRANSITION_FRAMES : 0);

export const totalFrames = (scenes: RenderScene[]) =>
	scenes.reduce((sum, s) => sum + Math.round(s.seconds * FPS), 0);

export const PropertyVideo: React.FC<PropertyVideoProps> = (props) => {
	const {scenes, music} = props;
	const {durationInFrames} = useVideoConfig();
	const last = scenes.length - 1;

	return (
		<AbsoluteFill style={{backgroundColor: '#0d0d0d'}}>
			<TransitionSeries>
				{scenes.map((scene, i) => (
					<React.Fragment key={i}>
						<TransitionSeries.Sequence durationInFrames={sceneFrames(scenes, i)}>
							<SceneMedia scene={scene} index={i} walkthrough={props.walkthrough} />
							{props.showText && i === 0 ? <TitleCard {...props} /> : null}
							{props.showText && i > 0 && i < last && scene.caption ? <Caption text={scene.caption} /> : null}
							{props.showText && i === last ? <CtaCard {...props} /> : null}
						</TransitionSeries.Sequence>
						{i < last ? (
							<TransitionSeries.Transition
								presentation={fade()}
								timing={linearTiming({durationInFrames: TRANSITION_FRAMES})}
							/>
						) : null}
					</React.Fragment>
				))}
			</TransitionSeries>
			{props.logo ? <CornerLogo src={props.logo} /> : null}
			{props.watermark ? <Watermark text={props.watermark} /> : null}
			{music ? (
				<Audio
					src={staticFile(music)}
					volume={(f) =>
						interpolate(f, [0, 20, durationInFrames - 45, durationInFrames], [0, 0.8, 0.8, 0], {
							extrapolateLeft: 'clamp',
							extrapolateRight: 'clamp',
						})
					}
				/>
			) : null}
		</AbsoluteFill>
	);
};

// Runway clip if we have one, otherwise a slow Ken Burns move over the still photo.
const SceneMedia: React.FC<{scene: RenderScene; index: number; walkthrough: boolean}> = ({scene, index, walkthrough}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const cover: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover'};

	if (scene.kind === 'video') {
		// Stretch the clip over the whole scene so it reaches its last frame (the next room) as the scene ends.
		const rate = scene.clipSeconds ? scene.clipSeconds / (durationInFrames / FPS) : 1;
		return (
			<AbsoluteFill>
				<OffthreadVideo src={staticFile(scene.src)} muted playbackRate={rate} style={cover} />
			</AbsoluteFill>
		);
	}

	const t = frame / durationInFrames;
	if (walkthrough) {
		// Steady forward push with a slight ease, so consecutive rooms read as one walk.
		const s = 1 + 0.2 * Easing.inOut(Easing.sin)(t);
		return (
			<AbsoluteFill style={{overflow: 'hidden'}}>
				<Img src={staticFile(scene.src)} style={{...cover, transform: `scale(${s})`}} />
			</AbsoluteFill>
		);
	}
	const zoomIn = index % 2 === 0;
	const scale = zoomIn ? 1.04 + 0.1 * t : 1.14 - 0.1 * t;
	const drift = (index % 3) - 1; // -1, 0, 1: vary the pan direction between scenes
	const x = drift * 2.5 * (t - 0.5);
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<Img
				src={staticFile(scene.src)}
				style={{...cover, transform: `scale(${scale}) translateX(${x}%)`}}
			/>
		</AbsoluteFill>
	);
};

const useIsPortrait = () => {
	const {width, height} = useVideoConfig();
	return height > width;
};

const useRise = (delay: number) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: frame - delay, fps, config: {damping: 200}});
	return {opacity: s, transform: `translateY(${(1 - s) * 30}px)`};
};

const Scrim: React.FC<{from: 'top' | 'bottom'; strength?: number}> = ({from, strength = 0.65}) => (
	<AbsoluteFill
		style={{
			background: `linear-gradient(to ${from === 'bottom' ? 'top' : 'bottom'}, rgba(0,0,0,${strength}) 0%, rgba(0,0,0,0) 45%)`,
		}}
	/>
);

const TitleCard: React.FC<PropertyVideoProps> = ({propertyName, location}) => {
	const portrait = useIsPortrait();
	const title = useRise(6);
	const sub = useRise(14);
	return (
		<>
			<Scrim from="bottom" strength={0.75} />
			<AbsoluteFill
				style={{
					justifyContent: 'flex-end',
					alignItems: 'center',
					paddingBottom: portrait ? 360 : 140,
					textAlign: 'center',
					color: 'white',
				}}
			>
				<div style={{...title, fontFamily: serif, fontSize: portrait ? 104 : 96, lineHeight: 1.05, padding: '0 80px'}}>
					{propertyName}
				</div>
				<div
					style={{
						...sub,
						fontFamily: sans,
						fontWeight: 400,
						fontSize: portrait ? 38 : 34,
						letterSpacing: 8,
						textTransform: 'uppercase',
						marginTop: 28,
						opacity: sub.opacity * 0.9,
					}}
				>
					{location}
				</div>
			</AbsoluteFill>
		</>
	);
};

const Caption: React.FC<{text: string}> = ({text}) => {
	const portrait = useIsPortrait();
	const style = useRise(8);
	return (
		<>
			<Scrim from="bottom" strength={0.55} />
			<AbsoluteFill
				style={{justifyContent: 'flex-end', alignItems: 'flex-start', padding: portrait ? '0 72px 320px' : '0 96px 110px'}}
			>
				<div
					style={{
						...style,
						fontFamily: sans,
						fontWeight: 600,
						fontSize: portrait ? 50 : 44,
						color: 'white',
						letterSpacing: 2,
						textTransform: 'uppercase',
						borderLeft: '6px solid #d8b477',
						paddingLeft: 28,
					}}
				>
					{text}
				</div>
			</AbsoluteFill>
		</>
	);
};

const CtaCard: React.FC<PropertyVideoProps> = ({cta, ctaSub, logo, propertyName}) => {
	const portrait = useIsPortrait();
	const frame = useCurrentFrame();
	const dim = interpolate(frame, [0, 18], [0, 0.55], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	const a = useRise(10);
	const b = useRise(18);
	return (
		<AbsoluteFill style={{backgroundColor: `rgba(0,0,0,${dim})`, justifyContent: 'center', alignItems: 'center', color: 'white', textAlign: 'center'}}>
			{logo ? <Img src={staticFile(logo)} style={{...a, maxWidth: portrait ? 420 : 360, maxHeight: 220, objectFit: 'contain', marginBottom: 56}} /> : null}
			<div style={{...a, fontFamily: serif, fontSize: portrait ? 64 : 56, marginBottom: 20, padding: '0 60px'}}>{propertyName}</div>
			<div
				style={{
					...b,
					fontFamily: sans,
					fontWeight: 600,
					fontSize: portrait ? 44 : 40,
					letterSpacing: 6,
					textTransform: 'uppercase',
					border: '3px solid #d8b477',
					padding: '22px 48px',
				}}
			>
				{cta}
			</div>
			{ctaSub ? <div style={{...b, fontFamily: sans, fontSize: portrait ? 34 : 30, marginTop: 36, opacity: b.opacity * 0.85}}>{ctaSub}</div> : null}
		</AbsoluteFill>
	);
};

const CornerLogo: React.FC<{src: string}> = ({src}) => {
	const portrait = useIsPortrait();
	return (
		<AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'flex-end', padding: portrait ? 64 : 48}}>
			<Img src={staticFile(src)} style={{maxWidth: 180, maxHeight: 110, objectFit: 'contain', opacity: 0.9}} />
		</AbsoluteFill>
	);
};

const Watermark: React.FC<{text: string}> = ({text}) => {
	const {width} = useVideoConfig();
	// Sized to the frame width so it never runs off the edge, whatever the aspect ratio.
	const size = Math.min(220, (width * 1.1) / (text.length * 0.95));
	return (
	<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}>
		<div
			style={{
				fontFamily: sans,
				fontWeight: 600,
				fontSize: size,
				letterSpacing: size * 0.12,
				color: 'rgba(255,255,255,0.28)',
				transform: 'rotate(-30deg)',
				whiteSpace: 'nowrap',
			}}
		>
			{text}
		</div>
	</AbsoluteFill>
	);
};
