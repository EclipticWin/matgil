/** Walk up the DOM from startEl to boundary returning first scrollable ancestor. */
export function findScrollParent(startEl, boundary) {
  let node = startEl;
  while (node && node !== boundary) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
