// Reads the text of an Apple Pages document (.pages, the zip format used since Pages 5 / 2013).
// Pure (browser and Node): the caller unzips the file and passes Index/Document.iwa.
//
// An .iwa file is a series of chunks (1 byte 0x00, 3 byte little-endian length) holding raw Snappy-compressed data.
// The decompressed stream is a series of archives: a varint length, an ArchiveInfo protobuf (field 2 = MessageInfo:
// field 1 type, field 3 length), then the payloads. Document text lives in TSWP.StorageArchive messages
// (type 2001): field 1 = kind (0 = body text), field 3 = text. Paragraphs end with "\n" (or U+2029, or a page/section break character);
// U+FFFC marks inline objects (images, footnotes) and is dropped.

const STORAGE_ARCHIVE = 2001;
const BODY = 0;

// Raw Snappy (no framing): varint uncompressed length, then literal / copy elements.
export function snappyDecompress(input: Uint8Array) {
  let pos = 0;
  let length = 0;
  for (let shift = 0; ; shift += 7) {
    const byte = input[pos++];
    length |= (byte & 0x7f) << shift;
    if (byte < 0x80) break;
  }
  const out = new Uint8Array(length);
  let o = 0;
  while (pos < input.length && o < length) {
    const tag = input[pos++];
    const type = tag & 3;
    if (type === 0) {
      let size = tag >>> 2;
      if (size >= 60) {
        const bytes = size - 59;
        size = 0;
        for (let i = 0; i < bytes; i += 1) size |= input[pos++] << (8 * i);
      }
      size += 1;
      out.set(input.subarray(pos, pos + size), o);
      pos += size;
      o += size;
      continue;
    }
    let size: number;
    let offset: number;
    if (type === 1) {
      size = ((tag >>> 2) & 7) + 4;
      offset = ((tag >>> 5) << 8) | input[pos++];
    } else if (type === 2) {
      size = (tag >>> 2) + 1;
      offset = input[pos] | (input[pos + 1] << 8);
      pos += 2;
    } else {
      size = (tag >>> 2) + 1;
      offset = (input[pos] | (input[pos + 1] << 8) | (input[pos + 2] << 16) | (input[pos + 3] << 24)) >>> 0;
      pos += 4;
    }
    if (!offset || offset > o) throw new Error("Snappy: bad offset");
    for (let i = 0; i < size; i += 1) out[o + i] = out[o - offset + i];
    o += size;
  }
  return out.subarray(0, o);
}

export function iwaDecompress(data: Uint8Array) {
  const parts: Uint8Array[] = [];
  let pos = 0;
  while (pos + 4 <= data.length) {
    if (data[pos] !== 0) throw new Error("IWA: unexpected chunk type");
    const size = data[pos + 1] | (data[pos + 2] << 8) | (data[pos + 3] << 16);
    parts.push(snappyDecompress(data.subarray(pos + 4, pos + 4 + size)));
    pos += 4 + size;
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let o = 0;
  for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}

type Field = { field: number; wire: number; value: number | Uint8Array };

function readVarint(data: Uint8Array, pos: number): [number, number] {
  let value = 0;
  let factor = 1;
  for (;;) {
    if (pos >= data.length) throw new Error("protobuf: truncated varint");
    const byte = data[pos++];
    value += (byte & 0x7f) * factor;
    if (byte < 0x80) return [value, pos];
    factor *= 128;
  }
}

function readFields(data: Uint8Array) {
  const fields: Field[] = [];
  let pos = 0;
  while (pos < data.length) {
    let key: number;
    [key, pos] = readVarint(data, pos);
    const field = Math.floor(key / 8);
    const wire = key & 7;
    if (wire === 0) { let value: number; [value, pos] = readVarint(data, pos); fields.push({ field, wire, value }); }
    else if (wire === 1) { pos += 8; }
    else if (wire === 2) { let size: number; [size, pos] = readVarint(data, pos); fields.push({ field, wire, value: data.subarray(pos, pos + size) }); pos += size; }
    else if (wire === 5) { pos += 4; }
    else throw new Error("protobuf: unsupported wire type");
  }
  return fields;
}

// Body text of a Pages document, split into paragraphs (empty lines removed).
export function pagesParagraphs(documentIwa: Uint8Array) {
  const data = iwaDecompress(documentIwa);
  const decoder = new TextDecoder("utf-8");
  const bodies: string[] = [];
  let pos = 0;
  while (pos < data.length) {
    let size: number;
    [size, pos] = readVarint(data, pos);
    const info = readFields(data.subarray(pos, pos + size));
    pos += size;
    for (const entry of info.filter((item) => item.field === 2 && item.value instanceof Uint8Array)) {
      const messageInfo = readFields(entry.value as Uint8Array);
      const type = Number(messageInfo.find((item) => item.field === 1)?.value ?? 0);
      const length = Number(messageInfo.find((item) => item.field === 3)?.value ?? 0);
      const payload = data.subarray(pos, pos + length);
      pos += length;
      if (type !== STORAGE_ARCHIVE) continue;
      const fields = readFields(payload);
      const kind = Number(fields.find((item) => item.field === 1 && item.wire === 0)?.value ?? BODY);
      if (kind !== BODY) continue;
      bodies.push(fields.filter((item) => item.field === 3 && item.value instanceof Uint8Array).map((item) => decoder.decode(item.value as Uint8Array)).join(""));
    }
  }
  // The main body is the longest body storage (text boxes and table cells are separate, shorter storages).
  const text = bodies.sort((a, b) => b.length - a.length)[0] ?? "";
  // Paragraph breaks: "\n", U+2029/U+2028, and Pages' own break characters — U+0004 section break, U+0005 page break
  // (a new chapter usually starts on a new page, so its heading follows the previous chapter's last line),
  // U+000B line break, U+000C / U+000E column breaks. Other control characters are dropped.
  return text.replace(/\ufffc/g, "")
    .split(/[\r\n\u2028\u2029\u0004\u0005\u000b\u000c\u000e]+/)
    .map((line) => line.replace(/[\u0000-\u0008\u000f-\u001f\u007f]/g, "").replace(/\u00a0/g, " ").trim())
    .filter(Boolean);
}
