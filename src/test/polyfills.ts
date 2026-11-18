// jsdom no trae AnimationEvent y sin él React escucha `webkitAnimationEnd` en lugar de `animationend`. Tiene que
// existir antes de que cargue react-dom (el carrusel del hero avanza con el fin de una animación), por eso va en su
// propio módulo, importado primero en setup.ts.
if (!('AnimationEvent' in window)) {
  Object.defineProperty(window, 'AnimationEvent', {
    configurable: true,
    value: class AnimationEvent extends Event {
      readonly animationName: string;
      readonly elapsedTime: number;
      readonly pseudoElement: string;
      constructor(type: string, init: AnimationEventInit = {}) {
        super(type, init);
        this.animationName = init.animationName ?? '';
        this.elapsedTime = init.elapsedTime ?? 0;
        this.pseudoElement = init.pseudoElement ?? '';
      }
    },
  });
}
