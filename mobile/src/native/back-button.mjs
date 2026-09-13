export function createBackButtonHandler({ router, appPlugin }) {
  return async function handleBack() {
    if (router.back()) return;
    await appPlugin.exitApp();
  };
}