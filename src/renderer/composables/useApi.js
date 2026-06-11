export function useApi() {
  if (!window.api) {
    throw new Error('window.api no está disponible. ¿Preload cargado correctamente?');
  }
  return window.api;
}
