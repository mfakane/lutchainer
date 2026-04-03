import fs from 'node:fs';

function usage() {
  console.error('usage: node tools/blender/compare/compare_reports.mjs <browser-report.json> <blender-report.json>');
}

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function channelDiff(a, b) {
  return Math.abs(Number(a) - Number(b));
}

function compareReports(browserReport, blenderReport) {
  const blenderById = new Map(blenderReport.samples.map(sample => [sample.id, sample]));
  const comparisons = [];

  for (const browserSample of browserReport.samples) {
    const blenderSample = blenderById.get(browserSample.id);
    if (!blenderSample) {
      continue;
    }

    const deltas = [
      channelDiff(browserSample.rgba[0], blenderSample.rgba[0]),
      channelDiff(browserSample.rgba[1], blenderSample.rgba[1]),
      channelDiff(browserSample.rgba[2], blenderSample.rgba[2]),
      channelDiff(browserSample.rgba[3], blenderSample.rgba[3]),
    ];
    const rgbMeanAbs = (deltas[0] + deltas[1] + deltas[2]) / 3;
    const rgbEuclidean = Math.sqrt(
      deltas[0] * deltas[0]
      + deltas[1] * deltas[1]
      + deltas[2] * deltas[2],
    );

    comparisons.push({
      id: browserSample.id,
      browserPixel: browserSample.pixel,
      blenderPixel: blenderSample.pixel,
      browserRgba: browserSample.rgba,
      blenderRgba: blenderSample.rgba,
      deltaRgba: deltas,
      rgbMeanAbs,
      rgbEuclidean,
    });
  }

  const rgbMeanAbsValues = comparisons.map(item => item.rgbMeanAbs);
  const rgbEuclideanValues = comparisons.map(item => item.rgbEuclidean);
  const mean = values => values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return {
    browserCanvas: browserReport.canvas,
    blenderCanvas: blenderReport.canvas,
    sampleCount: comparisons.length,
    meanRgbMeanAbs: mean(rgbMeanAbsValues),
    maxRgbMeanAbs: rgbMeanAbsValues.length > 0 ? Math.max(...rgbMeanAbsValues) : 0,
    meanRgbEuclidean: mean(rgbEuclideanValues),
    maxRgbEuclidean: rgbEuclideanValues.length > 0 ? Math.max(...rgbEuclideanValues) : 0,
    comparisons,
  };
}

const args = process.argv.slice(2);
if (args.length < 2) {
  usage();
  process.exit(2);
}

const browserReport = loadJson(args[0]);
const blenderReport = loadJson(args[1]);
console.log(JSON.stringify(compareReports(browserReport, blenderReport), null, 2));
