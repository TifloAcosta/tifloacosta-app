export function createNotificationCoordinator({ route } = {}) {
  if (typeof route !== 'function') throw new TypeError('route must be a function');

  let ready = false;
  let pending = null;

  async function receive(destination) {
    if (!ready) {
      pending = destination;
      return false;
    }
    await route(destination);
    return true;
  }

  async function markReady() {
    if (ready) return false;
    ready = true;
    const destination = pending;
    pending = null;
    if (destination) await route(destination);
    return true;
  }

  return { receive, markReady };
}
