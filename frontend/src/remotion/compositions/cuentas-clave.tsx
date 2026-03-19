import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockKeyAccounts } from "../data/mock-data";

// --- Sub-componentes visuales ---

function HealthDot({ score }: { score: number }) {
  const color = score >= 70 ? COLORS.green : score >= 40 ? COLORS.yellow : COLORS.red;
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}40`,
      }}
    />
  );
}

function AlertBanner() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        opacity,
      }}
    >
      <span style={{ fontSize: 14 }}>⚠️</span>
      <p style={{ color: COLORS.red, fontSize: 13, margin: 0 }}>
        2 cuentas clave necesitan atencion
      </p>
    </div>
  );
}

function AccountCard({
  account,
  index,
  isExpanded,
}: {
  account: typeof mockKeyAccounts[0];
  index: number;
  isExpanded: boolean;
}) {
  const frame = useCurrentFrame();
  const delay = 15 + index * 10;
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const trendIcon = account.trend === "up" ? "↑" : account.trend === "down" ? "↓" : "→";
  const trendColor = account.trend === "up" ? COLORS.green : account.trend === "down" ? COLORS.red : COLORS.textMuted;

  return (
    <div
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${isExpanded ? "rgba(129, 181, 161, 0.3)" : COLORS.border}`,
        borderRadius: 12,
        padding: 16,
        opacity,
        transition: "border-color 0.2s",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HealthDot score={account.health_score} />
          <p style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>
            {account.customer.name}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: trendColor, fontSize: 16 }}>{trendIcon}</span>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
            {account.health_score}%
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Facturacion</p>
          <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>
            ${(account.customer.total_purchases / 1000).toFixed(0)}k
          </p>
        </div>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Ultima compra</p>
          <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>
            {account.customer.last_purchase}
          </p>
        </div>
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Notas</p>
          <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>
            {account.notes_count}
          </p>
        </div>
        {account.pending_actions > 0 && (
          <div>
            <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>Pendientes</p>
            <p style={{ color: COLORS.red, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2 }}>
              {account.pending_actions}
            </p>
          </div>
        )}
      </div>

      {/* Expanded detail (solo para la primera card) */}
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
              <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: 0, marginTop: 6 }}>
                &quot;Hable con Juan, quiere ver catalogo nuevo&quot;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Composicion principal ---

export default function CuentasClaveComposition() {
  const frame = useCurrentFrame();
  // Expandir detalle de la primera card a los 350 frames
  const isFirstExpanded = frame >= 350;

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: "30px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
            Cuentas Clave
          </h2>
          <div
            style={{
              backgroundColor: "rgba(129, 181, 161, 0.1)",
              color: COLORS.brand,
              fontSize: 13,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 8,
            }}
          >
            + Agregar cuenta
          </div>
        </div>

        <AlertBanner />

        {/* Grid de cuentas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {mockKeyAccounts.map((account, i) => (
            <AccountCard
              key={account.customer.id}
              account={account}
              index={i}
              isExpanded={i === 0 && isFirstExpanded}
            />
          ))}
        </div>
      </div>

      {/* --- Anotaciones --- */}

      {/* Fase 1: Alert banner */}
      <Sequence from={20} durationInFrames={80}>
        <Highlight x={40} y={65} width={1200} height={40} startFrame={0} duration={70} />
      </Sequence>
      <TextOverlay
        text="El banner te avisa cuando alguna cuenta necesita atencion urgente"
        startFrame={25}
        duration={70}
      />

      {/* Fase 2: Health scores */}
      <Sequence from={120} durationInFrames={100}>
        <Highlight x={40} y={120} width={590} height={130} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="El color del punto te dice como esta la cuenta: verde bien, rojo necesita accion"
        startFrame={125}
        duration={85}
      />

      {/* Fase 3: Cuenta roja */}
      <Sequence from={250} durationInFrames={80}>
        <Highlight x={40} y={265} width={590} height={130} startFrame={0} duration={70} />
      </Sequence>
      <TextOverlay
        text="Mundo Celular tiene score bajo y 2 acciones pendientes — hay que actuar"
        startFrame={255}
        duration={70}
      />

      {/* Fase 4: Detalle expandido */}
      <TextOverlay
        text="Hace click en una cuenta para ver el detalle completo con notas y score"
        startFrame={370}
        duration={90}
      />

      {/* Cursor */}
      <AnimatedCursor
        startFrame={15}
        path={[
          { x: 640, y: 400, frame: 0 },
          { x: 400, y: 85, frame: 15 },     // Alert
          { x: 200, y: 180, frame: 110 },    // Primera cuenta
          { x: 200, y: 330, frame: 240 },    // Cuenta roja
          { x: 200, y: 180, frame: 335 },    // Click para expandir
          { x: 400, y: 400, frame: 450 },
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
