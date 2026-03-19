import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockKeyAccounts } from "../data/mock-data";

/**
 * Escenas del video Cuentas Clave (total ~42s = 1260 frames):
 *
 * 0-50:      Entrada
 * 50-260:    Escena 1 — Banner de alertas
 * 260-490:   Escena 2 — Cuenta saludable (verde) con detalle
 * 490-720:   Escena 3 — Cuenta en riesgo (roja) con acciones pendientes
 * 720-920:   Escena 4 — Detalle expandido (notas, puntaje, acciones)
 * 920-1100:  Escena 5 — Boton agregar cuenta
 * 1100-1260: Cierre
 */

const S1 = [50, 260] as const;
const S2 = [260, 490] as const;
const S3 = [490, 720] as const;
const S4 = [720, 920] as const;
const S5 = [920, 1100] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  return 0;
}

function HealthDot({ score }: { score: number }) {
  const color = score >= 70 ? COLORS.green : score >= 40 ? COLORS.yellow : COLORS.red;
  return <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />;
}

function AlertBanner() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, opacity }}>
      <span style={{ fontSize: 14 }}>⚠️</span>
      <p style={{ color: COLORS.red, fontSize: 13, margin: 0 }}>2 cuentas clave necesitan atencion</p>
    </div>
  );
}

function AccountCard({ account, index, isExpanded }: { account: typeof mockKeyAccounts[0]; index: number; isExpanded: boolean }) {
  const frame = useCurrentFrame();
  const delay = 15 + index * 10;
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const trendIcon = account.trend === "up" ? "↑" : account.trend === "down" ? "↓" : "→";
  const trendColor = account.trend === "up" ? COLORS.green : account.trend === "down" ? COLORS.red : COLORS.textMuted;

  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${isExpanded ? "rgba(129, 181, 161, 0.3)" : COLORS.border}`, borderRadius: 12, padding: 16, opacity }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HealthDot score={account.health_score} />
          <p style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>{account.customer.name}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: trendColor, fontSize: 16 }}>{trendIcon}</span>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>{account.health_score}%</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Facturacion</p>
          <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>${(account.customer.total_purchases / 1000).toFixed(0)}k</p>
        </div>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Ultima compra</p>
          <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>{account.customer.last_purchase}</p>
        </div>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Notas</p>
          <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>{account.notes_count}</p>
        </div>
        {account.pending_actions > 0 && (
          <div>
            <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Pendientes</p>
            <p style={{ color: COLORS.red, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>{account.pending_actions}</p>
          </div>
        )}
      </div>
      {isExpanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, backgroundColor: "rgba(129, 181, 161, 0.06)", borderRadius: 8, padding: 12 }}>
              <p style={{ color: COLORS.brand, fontSize: 12, fontWeight: 600, margin: 0 }}>Health Score</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${account.health_score}%`, height: "100%", backgroundColor: COLORS.green, borderRadius: 3 }} />
                </div>
                <span style={{ color: COLORS.green, fontSize: 14, fontWeight: 700 }}>{account.health_score}%</span>
              </div>
            </div>
            <div style={{ flex: 1, backgroundColor: "rgba(129, 181, 161, 0.06)", borderRadius: 8, padding: 12 }}>
              <p style={{ color: COLORS.brand, fontSize: 12, fontWeight: 600, margin: 0 }}>Ultima nota</p>
              <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: 0, marginTop: 6 }}>&quot;Hable con Juan, quiere ver catalogo nuevo&quot;</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddButton() {
  return (
    <div style={{ backgroundColor: "rgba(129, 181, 161, 0.1)", color: COLORS.brand, fontSize: 13, fontWeight: 500, padding: "6px 14px", borderRadius: 8, display: "inline-block" }}>
      + Agregar cuenta
    </div>
  );
}

export default function CuentasClaveComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);
  const isFirstExpanded = frame >= S4[0];

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: "30px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>Cuentas Clave</h2>
          <FocusWrapper highlightStart={S5[0]} highlightDuration={S5[1] - S5[0]} activeScene={scene} sceneRange={S5}>
            <AddButton />
          </FocusWrapper>
        </div>

        <div style={{ marginBottom: 16 }}>
          <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1}>
            <AlertBanner />
          </FocusWrapper>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2}>
            <AccountCard account={mockKeyAccounts[0]} index={0} isExpanded={isFirstExpanded} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2} dimWhenInactive={false}>
            <AccountCard account={mockKeyAccounts[1]} index={1} isExpanded={false} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S3[0]} highlightDuration={S3[1] - S3[0]} activeScene={scene} sceneRange={S3}>
            <AccountCard account={mockKeyAccounts[2]} index={2} isExpanded={false} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S3[0]} highlightDuration={S3[1] - S3[0]} activeScene={scene} sceneRange={S3} dimWhenInactive={false}>
            <AccountCard account={mockKeyAccounts[3]} index={3} isExpanded={false} />
          </FocusWrapper>
        </div>
      </div>

      <TextOverlay text="Si alguna cuenta clave necesita atencion urgente, este banner te lo dice apenas entras. El numero indica cuantas cuentas estan en estado critico o tienen acciones pendientes." startFrame={S1[0] + 5} duration={210} position="bottom" fontSize={24} />
      <TextOverlay text="Las cuentas saludables tienen punto verde y puntaje alto. Aca ves Electronica Sur con 92% — esta comprando regularmente y no necesita accion inmediata." startFrame={S2[0] + 5} duration={230} position="bottom" fontSize={24} />
      <TextOverlay text="Las cuentas en riesgo tienen punto rojo. Mundo Celular bajo a 45% y tiene 2 acciones pendientes. La flecha roja indica tendencia a la baja — hay que actuar." startFrame={S3[0] + 5} duration={230} position="bottom" fontSize={24} />
      <TextOverlay text="Al hacer click en una cuenta, se expande mostrando el puntaje de salud visual, las notas que registraste, y las acciones pendientes. Todo en un solo lugar." startFrame={S4[0] + 5} duration={200} position="bottom" fontSize={24} />
      <TextOverlay text="Con este boton agregas nuevas cuentas clave. Selecciona clientes que consideres estrategicos — no todos necesitan estar aca, solo los mas importantes." startFrame={S5[0] + 5} duration={200} position="bottom" fontSize={24} />
      <TextOverlay text="Cuentas Clave te ayuda a no descuidar a tus mejores clientes." startFrame={1110} duration={140} position="center" fontSize={26} />
    </AbsoluteFill>
  );
}
