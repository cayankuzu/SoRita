/**
 * A place name read off a map label. Google breaks a long label over two
 * lines, and a tapped point of interest reports it with the line break in
 * it; a one-line field then dropped the break and saved the words glued
 * together, "Chobani StadyumuFenerbahçe". Line breaks and runs of spaces
 * become one space.
 */
export function normalizeMapLabelName(name: string) {
  return name.replace(/\s+/g, ' ').trim();
}
