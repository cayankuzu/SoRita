import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const manifestPath = resolve(workspace, 'e2e/critical-flows.json');
const flows = JSON.parse(await readFile(manifestPath, 'utf8'));
const expectedIds = Array.from({ length: 30 }, (_, index) => index + 1);
const actualIds = flows.map((flow) => flow.id).sort((left, right) => left - right);

if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
  throw new Error('Critical-flow manifest must contain each flow id from 1 through 30 exactly once.');
}

for (const flow of flows) {
  if (
    !flow.name ||
    typeof flow.deviceEvidenceRequired !== 'boolean' ||
    !Array.isArray(flow.evidence) ||
    flow.evidence.length === 0
  ) {
    throw new Error(`Critical flow ${flow.id} is missing named automated evidence.`);
  }

  for (const evidencePath of flow.evidence) {
    await access(resolve(workspace, evidencePath));
  }

  if (flow.deviceEvidence !== undefined && !Array.isArray(flow.deviceEvidence)) {
    throw new Error(`Critical flow ${flow.id} has invalid device evidence.`);
  }

  for (const deviceEvidencePath of flow.deviceEvidence ?? []) {
    if (!/\.ya?ml$/i.test(deviceEvidencePath)) {
      throw new Error(`Critical flow ${flow.id} device evidence must be a Maestro YAML flow.`);
    }

    await access(resolve(workspace, deviceEvidencePath));
  }
}

const deviceRequiredFlows = flows.filter((flow) => flow.deviceEvidenceRequired);
const deviceCoveredFlows = deviceRequiredFlows.filter((flow) => flow.deviceEvidence?.length);

console.log(
  `[critical-flow-evidence] OK (${flows.length}/30 flows mapped; ` +
    `${deviceCoveredFlows.length}/${deviceRequiredFlows.length} device-required flows have Maestro evidence)`,
);
