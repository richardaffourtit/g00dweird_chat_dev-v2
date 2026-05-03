export function createWorldRuntime(scene) {
  return {
    mountWorld: () => scene,
    registerEntities: () => {},
    registerInteractions: () => {},
    teardown: () => {},
  };
}

export function getWorldRuntime(theme, scene) {
  const runtime = createWorldRuntime(scene);
  return { theme, ...runtime };
}
