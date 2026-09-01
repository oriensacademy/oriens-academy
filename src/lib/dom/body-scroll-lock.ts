const LOCK_COUNT_ATTRIBUTE = "data-oriens-scroll-lock-count";
const PREVIOUS_OVERFLOW_ATTRIBUTE = "data-oriens-previous-overflow";

export function lockBodyScroll() {
  const body = document.body;
  const lockCount = Number(body.getAttribute(LOCK_COUNT_ATTRIBUTE) || "0");

  if (lockCount === 0) {
    body.setAttribute(PREVIOUS_OVERFLOW_ATTRIBUTE, body.style.overflow);
    body.style.overflow = "hidden";
  }
  body.setAttribute(LOCK_COUNT_ATTRIBUTE, String(lockCount + 1));

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const currentCount = Number(body.getAttribute(LOCK_COUNT_ATTRIBUTE) || "1");
    const nextCount = Math.max(0, currentCount - 1);
    if (nextCount > 0) {
      body.setAttribute(LOCK_COUNT_ATTRIBUTE, String(nextCount));
      return;
    }

    body.style.overflow = body.getAttribute(PREVIOUS_OVERFLOW_ATTRIBUTE) || "";
    body.removeAttribute(LOCK_COUNT_ATTRIBUTE);
    body.removeAttribute(PREVIOUS_OVERFLOW_ATTRIBUTE);
  };
}
