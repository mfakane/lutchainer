import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  isRecord,
  parsePipelineArchive,
  type PipelineStepEntry,
  type PipelineZipLutEntry,
} from '../../../shared/lutchain/lutchain-archive.ts';
import {
  BLEND_MODES,
  BLEND_OPS,
  CHANNELS,
} from '../../../features/step/step-model.ts';
import { MAX_LUTS, MAX_STEPS } from '../../../features/pipeline/pipeline-constants.ts';
import { readLutchainBytes } from '../cli-archive.ts';

const PARAM_NAMES = new Set([
  'lightness',
  'specular',
  'halfLambert',
  'fresnel',
  'facing',
  'nDotH',
  'linearDepth',
  'r',
  'g',
  'b',
  'h',
  's',
  'v',
  'texU',
  'texV',
  'zero',
  'one',
]);

function isValidBlendMode(value: string): boolean {
  return BLEND_MODES.some(mode => mode.key === value);
}

function isValidBlendOp(value: string): boolean {
  return (BLEND_OPS as readonly string[]).includes(value);
}

function isValidChannelName(value: string): boolean {
  return CHANNELS.includes(value as typeof CHANNELS[number]);
}

function isValidParamName(value: string): boolean {
  return PARAM_NAMES.has(value);
}

export function getValidateUsage(): string {
  return [
    'Usage:',
    '  lutchainer validate [--json] <file.lutchain>',
  ].join('\n');
}

interface ValidateCommandOptions {
  filePath: string;
  json: boolean;
}

interface ValidateResult {
  valid: boolean;
  errors: string[];
}

function resolveValidateOptions(argv: string[]): ValidateCommandOptions {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      json: { type: 'boolean' },
    },
  });

  if (parsed.values.help) {
    throw new Error('__help__');
  }
  if (parsed.positionals.length !== 1) {
    throw new Error('validate requires exactly one positional argument.');
  }

  return {
    filePath: parsed.positionals[0],
    json: parsed.values.json ?? false,
  };
}

function validateLutEntries(luts: readonly PipelineZipLutEntry[], files: Record<string, Uint8Array>): string[] {
  const errors: string[] = [];
  const lutIds = new Set<string>();

  if (luts.length === 0) {
    errors.push('luts must contain at least one entry.');
  }
  if (luts.length > MAX_LUTS) {
    errors.push(`luts exceeds the maximum of ${MAX_LUTS}.`);
  }

  for (const [index, lut] of luts.entries()) {
    const fieldPrefix = `luts[${index}]`;
    if (typeof lut.id !== 'string' || lut.id.trim().length === 0) {
      errors.push(`${fieldPrefix}.id is invalid.`);
    } else if (lutIds.has(lut.id)) {
      errors.push(`luts contains duplicate id: ${lut.id}.`);
    } else {
      lutIds.add(lut.id);
    }

    if (typeof lut.name !== 'string' || lut.name.trim().length === 0) {
      errors.push(`${fieldPrefix}.name is invalid.`);
    }
    if (typeof lut.filename !== 'string' || lut.filename.trim().length === 0) {
      errors.push(`${fieldPrefix}.filename is invalid.`);
    } else if (!files[lut.filename]) {
      errors.push(`${fieldPrefix}.filename is missing from the archive: ${lut.filename}.`);
    }
    if (!Number.isInteger(lut.width) || lut.width <= 0) {
      errors.push(`${fieldPrefix}.width is invalid.`);
    }
    if (!Number.isInteger(lut.height) || lut.height <= 0) {
      errors.push(`${fieldPrefix}.height is invalid.`);
    }
  }

  return errors;
}

function validateStepOps(step: PipelineStepEntry, fieldPrefix: string): string[] {
  const errors: string[] = [];
  if (step.ops === undefined) {
    return errors;
  }
  if (!isRecord(step.ops)) {
    errors.push(`${fieldPrefix}.ops is invalid.`);
    return errors;
  }

  for (const [channelRaw, opRaw] of Object.entries(step.ops)) {
    if (!isValidChannelName(channelRaw)) {
      errors.push(`${fieldPrefix}.ops.${channelRaw} is invalid.`);
      continue;
    }
    if (typeof opRaw !== 'string' || !isValidBlendOp(opRaw)) {
      errors.push(`${fieldPrefix}.ops.${channelRaw} is invalid.`);
    }
  }

  return errors;
}

function validateStepEntries(steps: readonly PipelineStepEntry[], lutIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const stepIds = new Set<string>();

  if (steps.length > MAX_STEPS) {
    errors.push(`steps exceeds the maximum of ${MAX_STEPS}.`);
  }

  for (const [index, step] of steps.entries()) {
    const fieldPrefix = `steps[${index}]`;
    const normalizedStepId = typeof step.id === 'number' ? String(step.id) : step.id;
    if (typeof normalizedStepId !== 'string' || normalizedStepId.trim().length === 0) {
      errors.push(`${fieldPrefix}.id is invalid.`);
    } else if (stepIds.has(normalizedStepId)) {
      errors.push(`steps contains duplicate id: ${normalizedStepId}.`);
    } else {
      stepIds.add(normalizedStepId);
    }

    if (typeof step.lutId !== 'string' || step.lutId.trim().length === 0) {
      errors.push(`${fieldPrefix}.lutId is invalid.`);
    } else if (!lutIds.has(step.lutId)) {
      errors.push(`${fieldPrefix}.lutId references a missing LUT: ${step.lutId}.`);
    }

    if (step.label !== undefined && (typeof step.label !== 'string' || step.label.trim().length === 0)) {
      errors.push(`${fieldPrefix}.label is invalid.`);
    }
    if (step.muted !== undefined && typeof step.muted !== 'boolean') {
      errors.push(`${fieldPrefix}.muted is invalid.`);
    }
    if (typeof step.blendMode !== 'string' || !isValidBlendMode(step.blendMode)) {
      errors.push(`${fieldPrefix}.blendMode is invalid.`);
    }
    if (typeof step.xParam !== 'string' || !isValidParamName(step.xParam)) {
      errors.push(`${fieldPrefix}.xParam is invalid.`);
    }
    if (typeof step.yParam !== 'string' || !isValidParamName(step.yParam)) {
      errors.push(`${fieldPrefix}.yParam is invalid.`);
    }

    errors.push(...validateStepOps(step, fieldPrefix));
  }

  return errors;
}

function formatValidateResult(result: ValidateResult): string {
  if (result.valid) {
    return 'VALID';
  }
  return [
    'INVALID',
    ...result.errors.map(error => `- ${error}`),
  ].join('\n');
}

export async function runValidateCommand(argv: string[]): Promise<number> {
  try {
    const options = resolveValidateOptions(argv);
    const { bytes } = await readLutchainBytes(options.filePath);

    let result: ValidateResult;
    try {
      const archive = parsePipelineArchive(bytes, 2);
      const lutErrors = validateLutEntries(archive.manifest.luts, archive.files);
      const lutIds = new Set(
        archive.manifest.luts
          .filter(lut => typeof lut.id === 'string' && lut.id.trim().length > 0)
          .map(lut => lut.id),
      );
      const stepErrors = validateStepEntries(archive.manifest.steps, lutIds);
      result = {
        valid: lutErrors.length === 0 && stepErrors.length === 0,
        errors: [...lutErrors, ...stepErrors],
      };
    } catch (error) {
      result = {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatValidateResult(result)}\n`);
    }
    return result.valid ? 0 : 1;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      process.stdout.write(`${getValidateUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n${getValidateUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
