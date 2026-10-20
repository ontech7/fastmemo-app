// An in-memory stand-in for expo-file-system's File/Directory API, with its behaviour where it matters: the
// segments given to `new File(...)` are encoded as `Paths.join` does (`%` -> `%25`, space, `#`, `?`), the native side
// decodes the URI's %XX once, a move with `overwrite` deletes the target before renaming, a write creates the file. The disk is `globalThis.__fakeDisk` (see note-store.test.mjs), so a test can swap it, copy it
// at any step of a write (to boot from it, as after a crash) or make an operation fail.

const disk = () => globalThis.__fakeDisk;

const uriOf = (part) => (typeof part === "string" ? part : part.uri);
/** pathUtilities/url.ts encodeURLChars: what `Paths.join` does to every segment after the first. */
const encodeSegment = (segment) =>
  segment
    .replace(/%/g, "%25")
    .replace(/\\/g, "%5C")
    .replace(/ /g, "%20")
    .replace(/\?/g, "%3F")
    .replace(/#/g, "%23");
const join = (parts) =>
  parts
    .map(uriOf)
    .map((part, i) => (i === 0 ? part.replace(/\/+$/, "") : encodeSegment(part.replace(/^\/+|\/+$/g, ""))))
    .join("/");
const pathOf = (uri) =>
  uri
    .replace(/^file:\/\//, "")
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
const parentOf = (path) => path.slice(0, path.lastIndexOf("/"));
const baseOf = (path) => path.slice(path.lastIndexOf("/") + 1);

export class File {
  constructor(...parts) {
    this.uri = join(parts);
  }
  get path() {
    return pathOf(this.uri);
  }
  get name() {
    return baseOf(this.path);
  }
  get exists() {
    return disk().files.has(this.path);
  }
  textSync() {
    disk().step("read", this.path);
    const file = disk().files.get(this.path);
    if (!file) throw new Error(`no such file: ${this.path}`);
    return file.text;
  }
  writeSync(text) {
    if (!disk().dirs.has(parentOf(this.path))) throw new Error(`no such folder: ${parentOf(this.path)}`);
    disk().write(this.path, String(text));
  }
  moveSync(destination, options = {}) {
    const to = destination.path;
    if (disk().files.has(to)) {
      if (!options.overwrite) throw new Error(`already exists: ${to}`);
      disk().remove(to);
    }
    disk().rename(this.path, to);
    this.uri = destination.uri;
  }
  delete() {
    if (!this.exists) throw new Error(`no such file: ${this.path}`);
    disk().remove(this.path);
  }
  info() {
    const file = disk().files.get(this.path);
    return file ? { exists: true, size: file.text.length, modificationTime: file.mtime } : { exists: false };
  }
}

export class Directory {
  constructor(...parts) {
    this.uri = join(parts);
  }
  get path() {
    return pathOf(this.uri);
  }
  get exists() {
    return disk().dirs.has(this.path);
  }
  create() {
    disk().dirs.add(this.path);
  }
  list() {
    return [...disk().files.keys()]
      .filter((path) => parentOf(path) === this.path)
      .map((path) => new File(this.uri, baseOf(path)));
  }
}

export const Paths = {
  get document() {
    return new Directory("file:///data/files");
  },
};
