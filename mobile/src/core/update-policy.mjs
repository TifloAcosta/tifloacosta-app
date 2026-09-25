export function chooseUpdateMode(info = {}) {
  if (!info.available) return 'none';
  if (Number(info.priority) === 5 && info.immediateAllowed) return 'immediate';
  if (info.flexibleAllowed) return 'flexible';
  if (info.immediateAllowed) return 'immediate';
  return 'none';
}
