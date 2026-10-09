const closers: Array<() => void> = [];

export function pushCloser(close: () => void) {
  closers.push(close);
  return () => {
    const index = closers.lastIndexOf(close);
    if (index >= 0) closers.splice(index, 1);
  };
}

export function closeTop() {
  const close = closers.pop();
  if (!close) return false;
  close();
  return true;
}
