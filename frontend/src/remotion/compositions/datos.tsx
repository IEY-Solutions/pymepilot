import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockSyncLogs, mockDataCounts } from "../data/mock-data";

// --- Sub-componentes visuales ---

function ERPStatusCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 20,
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        🔗
      </div>
      <div>
        <p style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: 600, margin: 0 }}>
          Contabilium
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS.green }} />
          <p style={{ color: COLORS.green, fontSize: 13, margin: 0 }}>
            Conectado — ultima sync: 19/3 05:12
          </p>
        </div>
      </div>
    </div>
  );
}

function DataCountsGrid() {
  const frame = useCurrentFrame();
  const items = [
    { label: "Clientes", count: mockDataCounts.clientes, color: COLORS.brand },
    { label: "Productos", count: mockDataCounts.productos, color: COLORS.purple },
    { label: "Pedidos", count: mockDataCounts.pedidos, color: COLORS.orange },
    { label: "Predicciones", count: mockDataCounts.predicciones, color: COLORS.indigo },
  ];

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {items.map((item, i) => {
        const delay = 15 + i * 6;
        const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={item.label}
            style={{
              flex: 1,
              backgroundColor: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "14px 12px",
              textAlign: "center",
              opacity,
            }}
          >
            <p style={{ color: item.color, fontSize: 24, fontWeight: 700, margin: 0 }}>
              {item.count}
            </p>
            <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, marginTop: 4 }}>
              {item.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function UploadZone() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 40, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animacion de borde punteado pulsando
  const borderOpacity = interpolate(
    Math.sin((frame / 20) * Math.PI),
    [-1, 1],
    [0.2, 0.5]
  );

  return (
    <div
      style={{
        border: `2px dashed rgba(129, 181, 161, ${borderOpacity})`,
        borderRadius: 12,
        padding: 30,
        textAlign: "center",
        opacity,
      }}
    >
      <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0 }}>
        📄 Arrastra un archivo Excel aca o hace click para subir
      </p>
    </div>
  );
}

function SyncLogList() {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 4 }}>
        Ultimas sincronizaciones
      </p>
      {mockSyncLogs.map((log, i) => {
        const delay = 60 + i * 10;
        const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={log.id}
            style={{
              backgroundColor: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: log.status === "success" ? COLORS.green : COLORS.red,
                }}
              />
              <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: 0 }}>
                {log.source} ({log.type})
              </p>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>
              {log.customers}C / {log.products}P / {log.orders}O
            </p>
          </div>
        );
      })}
    </div>
  );
}

// --- Composicion principal ---

export default function DatosComposition() {
  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: 40 }}>
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 }}>
          Datos
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ERPStatusCard />
          <DataCountsGrid />
          <UploadZone />
          <SyncLogList />
        </div>
      </div>

      {/* --- Anotaciones --- */}

      {/* Fase 1: ERP status */}
      <Sequence from={30} durationInFrames={100}>
        <Highlight x={40} y={68} width={1200} height={80} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="Aca ves si tu ERP esta conectado y cuando fue la ultima sync"
        startFrame={35}
        duration={85}
      />

      {/* Fase 2: Data counts */}
      <Sequence from={150} durationInFrames={100}>
        <Highlight x={40} y={170} width={1200} height={80} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="Estos contadores te dicen cuantos datos tenes cargados"
        startFrame={155}
        duration={85}
      />

      {/* Fase 3: Upload zone */}
      <Sequence from={280} durationInFrames={100}>
        <Highlight x={40} y={270} width={1200} height={80} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="Si necesitas cargar datos a mano, arrastra un Excel aca"
        startFrame={285}
        duration={85}
      />

      {/* Fase 4: Sync logs */}
      <Sequence from={410} durationInFrames={100}>
        <Highlight x={40} y={380} width={1200} height={170} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="Revisa el historial de syncs para ver si hubo algun error"
        startFrame={415}
        duration={85}
      />

      {/* Cursor */}
      <AnimatedCursor
        startFrame={25}
        path={[
          { x: 640, y: 400, frame: 0 },
          { x: 300, y: 110, frame: 25 },
          { x: 400, y: 210, frame: 140 },
          { x: 640, y: 310, frame: 270 },
          { x: 300, y: 450, frame: 400 },
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
