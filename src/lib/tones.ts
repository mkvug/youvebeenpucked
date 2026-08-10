export type Tone = "teal" | "coral" | "mustard" | "plum";

export const TONES: Tone[] = ["teal", "coral", "mustard", "plum"];

export function toneFor(index: number): Tone {
  return TONES[index % TONES.length];
}
