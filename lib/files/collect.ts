type WebkitEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (file: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: WebkitEntry[] | null) => void) => void;
  };
};

function readAllEntries(reader: {
  readEntries: (cb: (entries: WebkitEntry[] | null) => void) => void;
}): Promise<WebkitEntry[]> {
  return new Promise((resolve) => {
    const all: WebkitEntry[] = [];
    const step = () => {
      reader.readEntries((batch) => {
        if (!batch || batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        step();
      });
    };
    step();
  });
}

async function walk(entry: WebkitEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    await new Promise<void>((resolve) => {
      entry.file?.(
        (file) => {
          out.push(file);
          resolve();
        },
        () => resolve(),
      );
    });
    return;
  }
  if (entry.isDirectory && entry.createReader) {
    const entries = await readAllEntries(entry.createReader());
    for (const child of entries) await walk(child, out);
  }
}

function entryOf(item: DataTransferItem): WebkitEntry | null {
  const getter = item as DataTransferItem & {
    webkitGetAsEntry?: () => WebkitEntry | null;
  };
  return getter.webkitGetAsEntry ? getter.webkitGetAsEntry() : null;
}

export async function filesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items.map(entryOf).filter((e): e is WebkitEntry => Boolean(e));

  if (entries.length > 0) {
    const out: File[] = [];
    for (const entry of entries) await walk(entry, out);
    if (out.length > 0) return out;
  }

  return Array.from(dataTransfer.files ?? []);
}
