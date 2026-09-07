import path from "node:path";
import zlib from "node:zlib";

/**
 * Compression formats the data files may be stored in.
 *
 * All three are built into Node's zlib, so a stored file is decompressed as a
 * stream straight into the parser — nothing is ever expanded onto disk, and no
 * dependency is needed.
 *
 * zstd is the default for new files. Measured on merged_pfam_kofam.csv it
 * reaches gzip's ratio in about half the bytes (0.093 vs 0.172) while
 * decompressing faster than gzip does, which is the rare case where the
 * smaller format is also the cheaper one to read. xz compresses ~6% smaller
 * still, but has no zlib binding, decompresses several times slower, and would
 * mean shipping a native module — so it is deliberately not supported.
 *
 * The order below is the search order: the strongest format wins when more
 * than one copy of a file exists.
 */
export const CODECS = {
  ".zst": {
    label: "zstd",
    sync: (buf) => zlib.zstdDecompressSync(buf),
    stream: () => zlib.createZstdDecompress(),
  },
  ".br": {
    label: "brotli",
    sync: (buf) => zlib.brotliDecompressSync(buf),
    stream: () => zlib.createBrotliDecompress(),
  },
  ".gz": {
    label: "gzip",
    sync: (buf) => zlib.gunzipSync(buf),
    stream: () => zlib.createGunzip(),
  },
};

/** Extensions to try, strongest first. */
export const CODEC_EXTENSIONS = Object.keys(CODECS);

/**
 * The codec a path's extension implies, or null when the file is plain.
 * Only the final extension is considered, so "foo.csv" is plain and
 * "foo.csv.zst" is zstd.
 */
export function codecFor(filePath) {
  return CODECS[path.extname(filePath)] ?? null;
}

/**
 * Find a file that may be stored plain or under any supported codec.
 *
 * A plain file wins over every compressed one, so a contributor can drop an
 * uncompressed CSV in without renaming anything. Returns null when no form of
 * the file exists.
 */
export function resolveCompressed(basePath, exists) {
  if (exists(basePath)) return { path: basePath, codec: null };
  for (const ext of CODEC_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (exists(candidate)) return { path: candidate, codec: CODECS[ext] };
  }
  return null;
}
