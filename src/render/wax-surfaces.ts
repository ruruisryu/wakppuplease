// Indexed Float32 storage preserves the solver's rendered precision while avoiding
// storing shared triangle vertices three times in the browser save.
export function encodeSurface(surface: number[][][]) {
  const vertices: number[] = [],
    indices: number[] = [],
    lookup = new Map<string, number>();
  for (const triangle of surface)
    for (const original of triangle) {
      const v = original.map(Math.fround),
        key = v.join(',');
      let index = lookup.get(key);
      if (index === undefined) {
        index = vertices.length / 6;
        lookup.set(key, index);
        vertices.push(...v);
      }
      indices.push(index);
    }
  if (vertices.length / 6 > 65535) throw Error('Wax plate exceeds save vertex limit');
  const bytes = new Uint8Array(8 + vertices.length * 4 + indices.length * 2),
    header = new DataView(bytes.buffer);
  header.setUint32(0, vertices.length / 6, true);
  header.setUint32(4, indices.length, true);
  bytes.set(new Uint8Array(new Float32Array(vertices).buffer), 8);
  bytes.set(new Uint8Array(new Uint16Array(indices).buffer), 8 + vertices.length * 4);
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384)
    text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
export function decodeSurface(text: string) {
  const decoded = atob(text),
    bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  if (bytes.length < 8) throw Error('Invalid saved wax header');
  const header = new DataView(bytes.buffer),
    count = header.getUint32(0, true),
    indexCount = header.getUint32(4, true);
  if (
    !count ||
    count > 65535 ||
    !indexCount ||
    indexCount % 3 ||
    bytes.length !== 8 + count * 24 + indexCount * 2
  )
    throw Error('Invalid saved wax surface length');
  const vertices = new Float32Array(bytes.buffer, 8, count * 6),
    indices = new Uint16Array(bytes.buffer, 8 + count * 24, indexCount);
  if (!vertices.every(Number.isFinite) || !indices.every((i) => i < count))
    throw Error('Invalid saved wax vertices');
  const result: number[][][] = [];
  for (let i = 0; i < indices.length; i += 3)
    result.push(
      Array.from(indices.subarray(i, i + 3), (index) =>
        Array.from(vertices.subarray(index * 6, index * 6 + 6)),
      ),
    );
  return result;
}
