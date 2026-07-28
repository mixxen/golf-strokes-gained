export const ROUND_EXPORT_FORMAT='golf-strokes-gained-rounds';
export const ROUND_EXPORT_VERSION=1;

export function createRoundsExport(rounds=[],exportedAt=new Date().toISOString()) {
  return {
    format:ROUND_EXPORT_FORMAT,
    version:ROUND_EXPORT_VERSION,
    exportedAt,
    roundCount:rounds.length,
    rounds:JSON.parse(JSON.stringify(rounds))
  };
}

export function roundsExportFilename(exportedAt=new Date().toISOString()) {
  const date=String(exportedAt).slice(0,10)||'backup';
  return `golf-strokes-gained-rounds-${date}.json`;
}
