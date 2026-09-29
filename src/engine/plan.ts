// Shows what `make --runway` would send to Runway, without calling it.
//   npm run plan -- jobs/demo
// Prints every clip (first frame, last frame, model, prompt, credits) and writes
// jobs/<id>/plan/NN.jpg: the exact cropped frames that would be uploaded, first | last.
//
// This file deliberately does not import the generating code; it cannot spend credits.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {clipFileFor, endPhotoFor, loadJob, usesRunway} from './job';
import {creditsFor, modelFor, supportsLastFrame} from './models';
import {RATIO, fullPrompt, prepareFrame, ratioFor, taskFileFor} from './prep';

try {
	process.loadEnvFile('.env');
} catch {}

const target = process.argv[2];
if (!target) {
	console.error('usage: npm run plan -- <job folder>');
	process.exit(1);
}
const {job, jobDir, format} = loadJob(target, process.argv.includes('--format') ? process.argv[process.argv.indexOf('--format') + 1] : undefined);
const planDir = path.join(jobDir, 'plan');
fs.rmSync(planDir, {recursive: true, force: true});
fs.mkdirSync(planDir, {recursive: true});

let total = 0;
let problems = 0;
const problem = (msg: string) => {
	problems++;
	console.log(`   !! ${msg}`);
};

job.scenes.forEach((s, i) => {
	const n = String(i + 1).padStart(2, '0');
	if (!usesRunway(s)) {
		console.log(`\n${n}. ${s.photo}  (SIN IA: zoom en Remotion, 0 creditos)`);
		console.log(`    ${s.seconds}s en pantalla | caption: ${s.caption ?? '-'}`);
		if (!fs.existsSync(path.join(jobDir, s.photo))) problem(`falta la foto ${s.photo}`);
		const a = prepareFrame(path.join(jobDir, s.photo), path.join(planDir, `${n}-first.jpg`), RATIO[format]);
		execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-vf', 'scale=-1:640', path.join(planDir, `${n}.jpg`)]);
		fs.rmSync(a);
		return;
	}
	const model = modelFor(Boolean(s.premium));
	const end = endPhotoFor(job, i);
	const clip = clipFileFor(jobDir, s, format, end);
	const cached = fs.existsSync(clip);
	const pending = fs.existsSync(taskFileFor(clip));
	const cost = cached || pending ? 0 : creditsFor(model);
	total += cost;

	console.log(`\n${n}. ${s.photo}  ->  ${end ?? '(sin foto final: fundido)'}`);
	console.log(`    ${s.seconds}s en pantalla | ${model} | ${cached ? 'YA GENERADO, 0 creditos' : pending ? 'PAGADO, pendiente de descargar, 0 creditos' : `${cost} creditos`}`);
	console.log(`    caption: ${s.caption ?? '-'}`);
	console.log(`    prompt: ${s.motion_prompt ?? '(default)'}`);

	if (!fs.existsSync(path.join(jobDir, s.photo))) problem(`falta la foto ${s.photo}`);
	if (end && !fs.existsSync(path.join(jobDir, end))) problem(`falta la foto final ${end}`);
	if (end && !supportsLastFrame(model)) problem(`${model} no acepta foto final: ${end} se ignoraria`);
	if (Number.isNaN(cost)) problem(`no conozco el precio de ${model}`);
	if (!s.motion_prompt) problem('sin motion_prompt');
	if (fullPrompt(s.motion_prompt ?? '').length > 1000) problem('prompt de mas de 1000 caracteres, se cortaria');

	// The exact frames that would be uploaded, side by side.
	const ratio = ratioFor(model, format);
	const a = prepareFrame(path.join(jobDir, s.photo), path.join(planDir, `${n}-first.jpg`), ratio);
	if (end) {
		const b = prepareFrame(path.join(jobDir, end), path.join(planDir, `${n}-last.jpg`), ratio);
		execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', '[0]scale=-1:640[a];[1]scale=-1:640[b];[a][b]hstack', path.join(planDir, `${n}.jpg`)]);
		fs.rmSync(b);
	} else {
		execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-vf', 'scale=-1:640', path.join(planDir, `${n}.jpg`)]);
	}
	fs.rmSync(a);
});

const seconds = job.scenes.reduce((sum, s) => sum + s.seconds, 0);
console.log(`\nTotal: ${job.scenes.length} escenas, ${seconds}s de video, ${total} creditos (~$${(total / 100).toFixed(2)} USD)`);
console.log(problems ? `${problems} problema(s): revisar antes de generar` : 'Sin problemas detectados');
console.log(`Frames a subir: ${path.relative(process.cwd(), planDir)}`);
