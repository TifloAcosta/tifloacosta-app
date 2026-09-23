export function createNotificationRouter(actions = {}) {
  if (typeof actions.home !== 'function') throw new TypeError('home action must be a function');

  return async function route(destination) {
    const type = destination?.type || 'general';
    const action = actions[type];

    if (type === 'general' || typeof action !== 'function') {
      await actions.home();
      return 'home';
    }

    await action(destination);
    return type;
  };
}
