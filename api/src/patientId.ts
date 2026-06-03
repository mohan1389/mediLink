const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomBase32Char(): string {
  const index = Math.floor(Math.random() * CROCKFORD_BASE32.length);
  return CROCKFORD_BASE32[index]!;
}

export function generateUniquePatientId(): string {
  let suffix = "";
  for (let i = 0; i < 8; i += 1) suffix += randomBase32Char();
  return `ML-${suffix}`;
}
