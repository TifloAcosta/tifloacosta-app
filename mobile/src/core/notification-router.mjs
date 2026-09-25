export function createNotificationRouter(actions = {}) {
  if (typeof actions.home !== 'function') throw new TypeError('home action must be a function');

  return async function route(destination) {
    const type = destination?.type || 'general';
    const action = actions[type];

    if (type === 'update' && typeof action !== 'function') {
      return 'update';
    }

    if (type === 'general' || typeof action !== 'function') {
      await actions.home();
      return 'home';
    }

    const handled = await action(destination);
    if (handled === false) {
      await actions.home();
      return 'home';
    }
    return type;
  };
}
