import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockSyncLogs, mockDataCounts } from "../data/mock-data";

/**
 * Escenas del video Datos (total ~30s = 900 frames):
 *
 * 0-50:     Entrada
 * 50-190:   Escena 1 — Estado de conexion ERP
 * 190-330:  Escena 2 — Contadores de datos
 * 330-490:  Escena 3 — Zona de upload
 * 490-650:  Escena 4 — Historial de syncs
 * 650-780:  Escena 5 — Frescura y que hacer si esta desactualizado
 * 780-900:  Cierre
 */

const S1 = [50, 190] as const;
const S2 = [190, 330] as const;
const S3 = [330, 490] as const;
const S4 = [490, 650] as const;
const S5 = [650, 780] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  return 0;
}

function ERPStatusCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 16, opacity }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(34, 197, 94, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
        🔗
      </div>
      <div>
        <p style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: 600, margin: 0 }}>Contabilium</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS.green }} />
          <p style={{ color: COLORS.green, fontSize: 13, margin: 0 }}>Conectado — ultima sync: 19/3 05:12</p>
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
        const opacity = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={item.label} style={{ flex: 1, backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 12px", textAlign: "center", opacity }}>
            <p style={{ color: item.color, fontSize: 24, fontWeight: 700, margin: 0 }}>{item.count}</p>
            <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, marginTop: 4 }}>{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function UploadZone() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 40, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const borderOpacity = interpolate(Math.sin((frame / 20) * Math.PI), [-1, 1], [0.2, 0.5]);

  return (
    <div style={{ border: `2px dashed rgba(129, 181, 161, ${borderOpacity})`, borderRadius: 12, padding: 30, textAlign: "center", opacity }}>
      <p style={{ color: COLORS.brand, fontSize: 28, margin: 0, marginBottom: 8 }}>📄</p>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: 0, marginBottom: 4 }}>Arrastra un archivo Excel aca</p>
      <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>o hace click para seleccionar desde tu computadora</p>
    </div>
  );
}

function SyncLogList() {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 4 }}>Ultimas sincronizaciones</p>
      {mockSyncLogs.map((log, i) => {
        const delay = 60 + i * 10;
        const opacity = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={log.id} style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: log.status === "success" ? COLORS.green : COLORS.red }} />
              <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: 0 }}>{log.source} ({log.type})</p>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>{log.customers}C / {log.products}P / {log.orders}O</p>
          </div>
        );
      })}
    </div>
  );
}

function FreshnessIndicator() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 70, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ display: "flex", gap: 12, opacity }}>
      {[
        { color: COLORS.green, label: "Verde: datos frescos", desc: "Ultimo sync < 24h" },
        { color: COLORS.yellow, label: "Amarillo: algo viejos", desc: "Ultimo sync 1-3 dias" },
        { color: COLORS.red, label: "Rojo: desactualizados", desc: "Ultimo sync > 3 dias" },
      ].map((item) => (
        <div key={item.label} style={{ flex: 1, backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: item.color }} />
            <p style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: 600, margin: 0 }}>{item.label}</p>
          </div>
          <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

export default function DatosComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: 40 }}>
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 }}>Datos</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1}>
            <ERPStatusCard />
          </FocusWrapper>
          <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2}>
            <DataCountsGrid />
          </FocusWrapper>
          <FocusWrapper highlightStart={S3[0]} highlightDuration={S3[1] - S3[0]} activeScene={scene} sceneRange={S3}>
            <UploadZone />
          </FocusWrapper>
          <FocusWrapper highlightStart={S4[0]} highlightDuration={S4[1] - S4[0]} activeScene={scene} sceneRange={S4}>
            <SyncLogList />
          </FocusWrapper>
          <FocusWrapper highlightStart={S5[0]} highlightDuration={S5[1] - S5[0]} activeScene={scene} sceneRange={S5}>
            <FreshnessIndicator />
          </FocusWrapper>
        </div>
      </div>

      <TextOverlay text="Esta tarjeta te muestra si tu ERP esta conectado. El punto verde significa que todo funciona. Si aparece rojo, revisa tu conexion o contacta soporte." startFrame={S1[0] + 5} duration={130} position="bottom" fontSize={24} />
      <TextOverlay text="Estos contadores resumen toda tu base de datos: cuantos clientes, productos, pedidos y predicciones tenes cargados. Si alguno esta en 0, falta sincronizar." startFrame={S2[0] + 5} duration={130} position="bottom" fontSize={24} />
      <TextOverlay text="Si necesitas cargar datos que no vienen del ERP, arrastra un archivo Excel aca. PymePilot lo analiza automaticamente y extrae clientes, productos y pedidos." startFrame={S3[0] + 5} duration={150} position="bottom" fontSize={24} />
      <TextOverlay text="El historial de syncs te muestra cada sincronizacion: de donde vino, si fue exitosa, y cuantos registros trajo (C=clientes, P=productos, O=ordenes)." startFrame={S4[0] + 5} duration={150} position="bottom" fontSize={24} />
      <TextOverlay text="El sistema de frescura usa colores de semaforo. Si ves amarillo o rojo en la pagina de Inicio, veni aca a sincronizar o subir un archivo actualizado." startFrame={S5[0] + 5} duration={120} position="bottom" fontSize={24} />
      <TextOverlay text="Esta seccion es el centro de control de tus datos — aca verificas que todo este al dia." startFrame={790} duration={90} position="center" fontSize={26} />
    </AbsoluteFill>
  );
}
