/** Join class names, dropping falsy values. Flattens nested arrays. */
export function cn(...args) {
  return args.flat(Infinity).filter(Boolean).join(' ');
}
