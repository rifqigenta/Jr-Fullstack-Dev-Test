import { randomInt } from "node:crypto";

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%&*?";

const ALL_CHARACTERS = UPPERCASE + LOWERCASE + NUMBERS + SYMBOLS;

function pick(characters: string): string {
  return characters[randomInt(characters.length)]!;
}

export function generatePassword(length = 12): string {
  if (length < 8) {
    throw new Error("Panjang password minimal 8 karakter.");
  }

  const characters = [pick(UPPERCASE), pick(LOWERCASE), pick(NUMBERS), pick(SYMBOLS)];

  while (characters.length < length) {
    characters.push(pick(ALL_CHARACTERS));
  }

  // Fisher-Yates shuffle menggunakan crypto.randomInt.
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [characters[i], characters[j]] = [characters[j]!, characters[i]!];
  }

  return characters.join("");
}
