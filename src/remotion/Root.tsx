import React from 'react';
import {Composition} from 'remotion';
import {FPS, PropertyVideo, totalFrames} from './PropertyVideo';
import {DIMENSIONS, type PropertyVideoProps} from '../engine/types';

// Studio defaults; real renders get their props from src/engine/make.ts.
const defaultProps: PropertyVideoProps = {
	propertyName: 'Casa Demo',
	location: 'Cartagena, Colombia',
	cta: 'Reserva tu estadía',
	ctaSub: null,
	logo: null,
	music: null,
	aspectRatio: '9:16',
	watermark: 'DEMO',
	walkthrough: false,
	showText: true,
	scenes: [
		{src: 'photos/01-hero.jpg', kind: 'image', role: 'hero', seconds: 3, caption: null},
		{src: 'photos/02-living.jpg', kind: 'image', role: 'living_room', seconds: 4, caption: 'Sala amplia'},
		{src: 'photos/03-bedroom.jpg', kind: 'image', role: 'bedroom', seconds: 4, caption: '3 habitaciones'},
		{src: 'photos/04-pool.jpg', kind: 'image', role: 'pool', seconds: 4, caption: 'Piscina privada'},
		{src: 'photos/05-view.jpg', kind: 'image', role: 'view', seconds: 4, caption: 'Vista al mar'},
		{src: 'photos/06-kitchen.jpg', kind: 'image', role: 'kitchen', seconds: 3, caption: 'Cocina equipada'},
		{src: 'photos/07-exterior.jpg', kind: 'image', role: 'cta', seconds: 3, caption: null},
	],
};

export const Root: React.FC = () => (
	<Composition
		id="PropertyVideo"
		component={PropertyVideo}
		fps={FPS}
		width={1080}
		height={1920}
		durationInFrames={totalFrames(defaultProps.scenes)}
		defaultProps={defaultProps}
		calculateMetadata={({props}) => ({
			...DIMENSIONS[props.aspectRatio],
			durationInFrames: totalFrames(props.scenes),
		})}
	/>
);
