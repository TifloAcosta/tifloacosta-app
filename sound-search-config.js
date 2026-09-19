window.TIFLO_SOUND_CONFIG = Object.freeze({
  endpoint: 'https://download.tifloacosta.com/sounds/search',
  providers: Object.freeze(['freesound']),
  externalBanks: Object.freeze([
    Object.freeze({ id:'mixkit', name:'Mixkit', url:'https://mixkit.co/free-sound-effects/' }),
    Object.freeze({ id:'pixabay', name:'Pixabay', url:'https://pixabay.com/sound-effects/' })
  ])
});
