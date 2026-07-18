let idSequence = 0;

function randomHex(length: number) {
  let output = '';

  while (output.length < length) {
    output += Math.floor(Math.random() * 16).toString(16);
  }

  return output.slice(0, length);
}

export function createUuid() {
  idSequence = (idSequence + 1) % 0xffff;

  const timeHex = Date.now().toString(16).padStart(12, '0').slice(-12);
  const sequenceHex = idSequence.toString(16).padStart(4, '0');
  const randomA = randomHex(4);
  const randomB = randomHex(4);
  const randomC = randomHex(12);

  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-4${randomA.slice(1)}-a${randomB.slice(1)}-${sequenceHex}${randomC.slice(4)}`;
}
