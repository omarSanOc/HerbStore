export const es = {
  translation: {
    foundations: {
      title: 'HerbStore',
      subtitle: 'Fundamentos de React Native: componentes, hooks y Flexbox.',
      languageHeading: 'Idioma de la interfaz',
      spanish: 'Español',
      english: 'Inglés',
      selectSpanishHint: 'Cambia todos los textos de esta pantalla a español.',
      selectEnglishHint: 'Cambia todos los textos de esta pantalla a inglés.',
      systemPreferencesHeading: 'Preferencias del sistema',
      theme: 'Tema: {{theme}}',
      themeLight: 'claro',
      themeDark: 'oscuro',
      reducedMotion: 'Movimiento reducido: {{setting}}',
      reducedMotionOn: 'activado',
      reducedMotionOff: 'desactivado',
      accessibilityNote:
        'El texto respeta la escala del sistema y cada botón mide al menos 48 puntos.',
      hooks: {
        heading: 'Estado, efecto y limpieza',
        description:
          'El contador vive en este bloque. El temporizador inicia un intervalo en un efecto y lo limpia al pausar u ocultar.',
        tapCount: 'Toques: {{count}}',
        addTap: 'Sumar 1',
        addTapHint: 'Incrementa el contador local con una actualización funcional.',
        elapsed: 'Segundos activos: {{seconds}}',
        timerRunning: 'Estado: en marcha',
        timerPaused: 'Estado: en pausa',
        timerUnmounted: 'Temporizador oculto: su estado y su intervalo se eliminaron.',
        startTimer: 'Iniciar',
        pauseTimer: 'Pausar',
        toggleRunningHint: 'Inicia o pausa el intervalo del temporizador.',
        showTimer: 'Mostrar temporizador',
        hideTimer: 'Ocultar temporizador',
        toggleMountedHint: 'Monta o desmonta el temporizador y ejecuta la limpieza de su efecto.',
      },
      layout: {
        heading: 'Flexbox y unidades independientes de densidad',
        description:
          'La pantalla guarda la dirección y la entrega al bloque como prop de solo lectura.',
        row: 'Fila',
        column: 'Columna',
        rowHint: 'Distribuye los bloques horizontalmente.',
        columnHint: 'Distribuye los bloques verticalmente.',
        containerLabel: 'Contenedor flexible en {{direction}}',
        tileLabel: 'Bloque con flex {{flex}}',
        density: '1 unidad de diseño equivale a {{ratio}} píxeles físicos en este dispositivo.',
      },
      ref: {
        heading: 'Referencia imperativa',
        description:
          'Una referencia apunta a la lista desplazable sin provocar renders. El desplazamiento solo se anima si el movimiento reducido está desactivado.',
        scrollToTop: 'Volver arriba',
        scrollToTopHint: 'Desplaza la pantalla hasta el inicio.',
      },
    },
  },
} as const;
