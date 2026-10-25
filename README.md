# Horarium · Tu hora natural

Reloj de **horas temporales**, como los contaban los monjes: la luz del día se reparte en 12
horas y la noche en otras 12, así que en verano las horas de día son largas y en invierno
cortas. Los ocho oficios de la Regla de San Benito (Prima, Tercia, Sexta, Nona, Vísperas,
Completas, Maitines y Laudes) marcan el día, y la hora de reloj sigue siempre a la vista.

- **Esfera natural**: el día arriba y la noche abajo; el amanecer siempre a la izquierda,
  el mediodía arriba y el ocaso a la derecha. Lo que cambia con la estación es la velocidad
  de la aguja.
- **Dónde**: tu ubicación por GPS, Madrid o cualquier ciudad (buscador de Open-Meteo). Las
  horas salen en la zona horaria del lugar.
- **Sin red**: es una PWA; se instala en el móvil y abre sin conexión.

El día va de la salida a la puesta de sol, con la refracción estándar en el horizonte
(fórmulas de SunCalc). El error es de uno o dos minutos.

## Desarrollo

Sin dependencias ni compilación: HTML, CSS y JavaScript tal cual.

```sh
python -m http.server 8765      # y abrir http://127.0.0.1:8765
node test.mjs                   # pruebas del cálculo
```

Al publicar un cambio, sube `V` en `sw.js` para que los móviles bajen la versión nueva.

## Licencia

Código bajo MIT. Tipografía Alegreya (Huerta Tipográfica) bajo SIL Open Font License,
en `fonts/OFL.txt`.
