/**
 * Sonido de caja registradora sintetizado con Web Audio API.
 * No requiere archivos externos — se genera en el navegador.
 *
 * QUE HACE: Genera dos "ching" metalicos en secuencia rapida,
 * simulando el sonido clasico de una caja registradora.
 *
 * CONCEPTO: Web Audio API permite crear sonidos desde cero
 * usando osciladores (generadores de ondas). Combinando
 * frecuencias altas con un decay rapido se logra el efecto
 * metalico del "cha-ching".
 */
export function playCashRegisterSound(): void {
  try {
    const ctx = new AudioContext();

    function playChing(startTime: number, freq: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);

      // Decay rapido para efecto metalico
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }

    const now = ctx.currentTime;
    // Primer "cha" (tono bajo)
    playChing(now, 1200);
    // Segundo "ching" (tono alto, ligeramente despues)
    playChing(now + 0.12, 1800);
    // Tercer toque de cierre
    playChing(now + 0.25, 2400);

    // Limpiar AudioContext despues de que terminen los sonidos
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Si Web Audio API no esta disponible, fallar silenciosamente
  }
}
