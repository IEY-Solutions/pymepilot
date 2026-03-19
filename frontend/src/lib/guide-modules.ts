import {
  Home,
  Columns3,
  Star,
  BarChart3,
  Trophy,
  Database,
  Bot,
  type LucideIcon,
} from "lucide-react";

// --- Tipos ---

export type GuideSection = {
  /** Identificador unico (slug) */
  id: string;
  /** Nombre visible de la seccion */
  title: string;
  /** Icono de Lucide (mismo del sidebar) */
  icon: LucideIcon;
  /** Bajada: 1-2 oraciones explicando que es */
  description: string;
  /** 3-4 bullets accionables */
  bullets: string[];
  /** Ruta del dashboard a la que apunta el CTA */
  route: string;
  /** Duracion del video en frames (30fps) */
  videoDurationFrames: number;
};

export type GuideModule = {
  /** Identificador unico (slug, usado en la URL) */
  id: string;
  /** Nombre visible del modulo */
  name: string;
  /** Descripcion corta para la card del selector */
  description: string;
  /** Icono principal del modulo */
  icon: LucideIcon;
  /** Si esta disponible para ver (false = "Proximamente") */
  available: boolean;
  /** Secciones del modulo con video + texto */
  sections: GuideSection[];
};

// --- Modulos ---

export const guideModules: GuideModule[] = [
  {
    id: "seguimiento",
    name: "Seguimiento",
    description:
      "Aprende a usar el sistema completo: desde ver tus metricas hasta contactar clientes y cerrar ventas.",
    icon: Home,
    available: true,
    sections: [
      {
        id: "inicio",
        title: "Inicio",
        icon: Home,
        description:
          "Tu resumen diario. De un vistazo sabes cuantos clientes te esperan, como viene tu tasa de contacto, y si tus datos estan frescos.",
        bullets: [
          "Ve cuantos clientes tenés pendientes de contactar hoy",
          "Controla tu tasa de contacto para saber si vas bien",
          "Detecta de un vistazo si tus datos necesitan actualizarse",
          "Accede rapido a las secciones que mas usas",
        ],
        route: "/",
        videoDurationFrames: 750, // 25s x 30fps
      },
      {
        id: "pipeline",
        title: "Pipeline",
        icon: Columns3,
        description:
          "Aca vas a ver todos los clientes que PymePilot te sugiere contactar, organizados como un tablero. Arrastras las tarjetas segun vayas avanzando con cada cliente.",
        bullets: [
          "Cada tarjeta tiene el mensaje sugerido listo para copiar y mandar",
          "Podes agregar notas de lo que hablaste con el cliente",
          "Los seguimientos se programan solos segun la etapa",
          "Si no moves una tarjeta en X dias, avanza sola para que no se te escape",
        ],
        route: "/pipeline",
        videoDurationFrames: 1050, // 35s x 30fps
      },
      {
        id: "cuentas-clave",
        title: "Cuentas Clave",
        icon: Star,
        description:
          "Tus clientes mas importantes en un solo lugar. Ves como estan, si necesitan atencion, y que hacer con cada uno.",
        bullets: [
          "Cada cuenta tiene un score de salud: verde, amarillo o rojo",
          "Podes ver el resumen financiero de cada cliente",
          "Agrega notas y acciones pendientes para no olvidarte de nada",
          "El sistema te avisa cuando una cuenta necesita atencion",
        ],
        route: "/cuentas-clave",
        videoDurationFrames: 900, // 30s x 30fps
      },
      {
        id: "metricas",
        title: "Metricas",
        icon: BarChart3,
        description:
          "Los numeros de tu negocio en graficos claros. Facturacion, churn, ticket promedio, ranking de clientes y productos.",
        bullets: [
          "Mira como viene tu facturacion mes a mes",
          "Detecta si estas perdiendo clientes con el grafico de churn",
          "Descubri cuales son tus mejores clientes y productos",
          "Compara periodos para ver si estas mejorando",
        ],
        route: "/metricas",
        videoDurationFrames: 900, // 30s x 30fps
      },
      {
        id: "mis-ventas",
        title: "Mis Ventas",
        icon: Trophy,
        description:
          "Tu historial de ventas y logros. Aca ves que clientes compraron gracias a que vos los contactaste.",
        bullets: [
          "Ve cuantas ventas se atribuyeron a tus contactos",
          "Segui tu racha de dias consecutivos vendiendo",
          "Filtra por tipo de recomendacion (reposicion, activacion, etc.)",
          "Festeja cada venta con la animacion de confeti",
        ],
        route: "/logros",
        videoDurationFrames: 750, // 25s x 30fps
      },
      {
        id: "datos",
        title: "Datos",
        icon: Database,
        description:
          "Aca controlas de donde vienen tus datos. Conexion al ERP, archivos subidos, y el estado de cada sincronizacion.",
        bullets: [
          "Mira si tu ERP esta conectado y cuando fue la ultima sync",
          "Subi archivos Excel si necesitas cargar datos manualmente",
          "Revisa el historial de sincronizaciones y si hubo errores",
          "Controla cuantos clientes, productos y pedidos tenes cargados",
        ],
        route: "/datos",
        videoDurationFrames: 900, // 30s x 30fps
      },
      {
        id: "asesor",
        title: "Asesor IA",
        icon: Bot,
        description:
          "Tu asistente inteligente. Preguntale lo que quieras sobre tu negocio y te responde con datos reales.",
        bullets: [
          "Pregunta cosas como 'quien es mi mejor cliente?' o 'que producto se vende mas?'",
          "El asesor consulta tu base de datos real para responderte",
          "Tenes 20 preguntas por dia incluidas",
          "Podes usarlo desde la burbuja de chat o desde esta pagina completa",
        ],
        route: "/asesor",
        videoDurationFrames: 750, // 25s x 30fps
      },
    ],
  },
];

// --- Helpers ---

export function getModuleById(id: string): GuideModule | undefined {
  return guideModules.find((m) => m.id === id);
}
