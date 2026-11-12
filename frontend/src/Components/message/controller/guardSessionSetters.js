export function guardSessionSetters(state, session) {
  const guarded = {};
  for (const [name, setter] of Object.entries(state)) {
    if (!name.startsWith('set') || typeof setter !== 'function') continue;
    guarded[name] = (nextValue) => {
      if (!session.isCurrent()) return;
      setter((previous) => {
        if (!session.isCurrent()) return previous;
        return typeof nextValue === 'function' ? nextValue(previous) : nextValue;
      });
    };
  }
  return guarded;
}
