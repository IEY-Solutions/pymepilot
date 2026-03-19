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
          "Tu resumen diario. Es lo primero que ves al entrar — de un vistazo sabes como esta tu negocio hoy: cuantos clientes te esperan, como viene tu tasa de contacto, si el sistema corrio bien, y si tus datos estan frescos.",
        bullets: [
          "'Pendientes' te dice cuantos clientes PymePilot recomienda contactar hoy. Este numero se actualiza cada mañana a las 5 AM automaticamente",
          "'Tasa de contacto' mide que porcentaje de los clientes sugeridos efectivamente contactaste este mes. Cuanto mas alta, mejor estas aprovechando las recomendaciones",
          "Cuando el sistema genera recomendaciones, aparece una tarjeta especial que te dice cuantos contactos sugirio y te lleva directo al Pipeline con un click",
          "El indicador de frescura usa colores de semaforo: verde (datos al dia), amarillo (datos de hace 1-3 dias), rojo (desactualizados). Si ves rojo, anda a 'Datos' para sincronizar",
          "'Clientes activos' cuenta los que compraron recientemente y 'Ultima actualizacion' te dice cuando se sincronizaron los datos desde tu sistema de facturacion",
        ],
        route: "/",
        videoDurationFrames: 1140, // 38s x 30fps
      },
      {
        id: "pipeline",
        title: "Pipeline",
        icon: Columns3,
        description:
          "Tu tablero de ventas del dia a dia. PymePilot analiza tus datos y genera tarjetas con clientes que te conviene contactar. Vos los moves por las columnas a medida que avanzas: desde el primer contacto hasta cerrar la venta.",
        bullets: [
          "Las tarjetas aparecen automaticamente en 'A contactar' cada mañana. PymePilot las genera analizando patrones de compra de tus clientes",
          "Cada tarjeta incluye un mensaje sugerido que podes copiar con un click. Tambien muestra el nivel de confianza y la prioridad (punto rojo = urgente, amarillo = normal)",
          "Arrastra las tarjetas entre columnas cuando avances con un cliente: Contactado → En seguimiento → Por cotizar → Cotizacion enviada → Vendido",
          "El sistema programa seguimientos automaticos. Si un cliente esta en 'En seguimiento', te avisa cuando es momento de volver a contactarlo",
          "Podes agregar notas en cada tarjeta para registrar que hablaste, que pidio, o cualquier detalle importante para el proximo contacto",
          "Si no moves una tarjeta en un tiempo determinado, avanza sola para que no se te escape ningun cliente",
        ],
        route: "/pipeline",
        videoDurationFrames: 1470, // 49s x 30fps
      },
      {
        id: "cuentas-clave",
        title: "Cuentas Clave",
        icon: Star,
        description:
          "Aca gestionas tus clientes mas importantes — los que mas facturan o son estrategicos para tu negocio. Cada uno tiene un 'puntaje de salud' que te dice si esta todo bien o si necesita atencion.",
        bullets: [
          "El puntaje de salud va de 0 a 100 y usa colores de semaforo: verde (70+) esta todo bien, amarillo (40-69) hay que prestar atencion, rojo (<40) necesita accion urgente",
          "Un banner te avisa apenas entras si hay cuentas en estado critico con acciones pendientes",
          "Hace click en cualquier cuenta para ver su perfil completo: resumen financiero, historial de compras, notas registradas, y acciones pendientes",
          "Podes agregar notas en cada cuenta para registrar conversaciones, acuerdos, o cualquier dato importante. Las notas quedan como historial permanente",
          "El sistema detecta tendencias: flechas verdes (mejorando), rojas (empeorando) o grises (estable). Esto te ayuda a anticiparte a problemas",
          "Usa el boton '+ Agregar cuenta' para marcar nuevos clientes como estrategicos. No todos necesitan estar aca — solo los que realmente importan",
        ],
        route: "/cuentas-clave",
        videoDurationFrames: 1260, // 42s x 30fps
      },
      {
        id: "metricas",
        title: "Metricas",
        icon: BarChart3,
        description:
          "Tu tablero de numeros: facturacion, clientes perdidos, ticket promedio, y rankings. Tiene 5 pestañas que te dan distintas vistas de como va tu negocio, con graficos claros y datos actualizados.",
        bullets: [
          "'Rendimiento' muestra 4 indicadores clave: facturacion total, porcentaje de clientes perdidos, ticket promedio, y valor atribuido a PymePilot",
          "El grafico de facturacion te muestra mes a mes cuanto facturas. Si la tendencia baja, mira los clientes perdidos y los inactivos para entender por que",
          "El porcentaje de clientes perdidos mide cuantos dejaron de comprar. Un 7% significa que de cada 100, 7 no volvieron. Cuanto mas bajo, mejor",
          "'Clientes' te muestra un ranking de tus mejores compradores ordenados por facturacion. Usa esta info para decidir a quien priorizar",
          "'Productos' te dice cuales son tus productos estrella y cuales necesitan mas push comercial",
          "'Comparar' te permite elegir dos periodos y ver las diferencias lado a lado — ideal para medir el impacto de tus acciones comerciales",
        ],
        route: "/metricas",
        videoDurationFrames: 1260, // 42s x 30fps
      },
      {
        id: "mis-ventas",
        title: "Mis Ventas",
        icon: Trophy,
        description:
          "Tu historial de logros comerciales. Aca ves las ventas que cerraste y, lo mas importante, cuantas vinieron de clientes que PymePilot te sugirio contactar. Es donde medis el impacto real del sistema.",
        bullets: [
          "'Mis ventas del mes' muestra TODAS tus ventas: cuantas ordenes cerraste y cuanto facturaron en total",
          "'Ventas con PymePilot' es la metrica clave: cuantas de esas ventas vinieron de recomendaciones del sistema. Asi ves el retorno concreto",
          "La racha cuenta dias consecutivos vendiendo. Cuando llegas a 3, el icono se prende fuego para motivarte a seguir sin cortar",
          "Los filtros te permiten ver logros por tipo de recomendacion: Reposicion (cliente habitual que necesita reponer), Venta cruzada (ofrecerle un producto nuevo), Activacion (cliente nuevo) o Recuperacion (cliente que dejo de comprar)",
          "Cada tarjeta de logro muestra el cliente, el monto, los productos que compro, y de que tipo de recomendacion vino. Es tu evidencia concreta de resultados",
        ],
        route: "/logros",
        videoDurationFrames: 1050, // 35s x 30fps
      },
      {
        id: "datos",
        title: "Datos",
        icon: Database,
        description:
          "El centro de control de tus datos. Aca verificas que tu sistema de facturacion esta conectado, revisas el historial de actualizaciones, subis archivos Excel, y controlas que toda tu informacion este al dia.",
        bullets: [
          "La tarjeta de conexion te muestra si tu sistema de facturacion esta conectado (punto verde) o desconectado (punto rojo). Incluye la fecha y hora de la ultima actualizacion exitosa",
          "Los contadores resumen tu base de datos: cuantos clientes, productos, pedidos y predicciones tenes. Si alguno esta en 0, falta sincronizar o subir datos",
          "La zona de carga te permite arrastrar archivos Excel para cargar datos que no vienen de tu sistema de facturacion. PymePilot los analiza automaticamente y extrae la informacion",
          "El historial de actualizaciones muestra cada sincronizacion con detalle: de donde vino, si fue exitosa, y cuantos registros trajo (C=clientes, P=productos, O=ordenes)",
          "El sistema de frescura usa colores: verde (< 24h), amarillo (1-3 dias), rojo (> 3 dias). Si la pagina de Inicio muestra rojo, veni aca a sincronizar",
        ],
        route: "/datos",
        videoDurationFrames: 1260, // 42s x 30fps
      },
      {
        id: "asesor",
        title: "Asesor IA",
        icon: Bot,
        description:
          "Tu asistente de negocios personal. Funciona como un chat: le escribis una pregunta en lenguaje normal y te responde con datos reales de tu negocio. No inventa — consulta tu base de datos para cada respuesta.",
        bullets: [
          "Escribi preguntas en lenguaje natural: 'quien es mi mejor cliente?', 'que producto se vende mas?', 'cuantos clientes tengo inactivos?', 'como viene mi facturacion este mes?'",
          "Cada respuesta viene de tus datos reales. El asesor tiene acceso a clientes, productos, pedidos, predicciones, y metricas de tu negocio",
          "Tenes 20 preguntas por dia incluidas. El contador arriba a la derecha te muestra cuantas usaste hoy",
          "Podes acceder al asesor de dos formas: desde esta pagina completa o desde la burbuja de chat que aparece en cualquier seccion del dashboard",
          "El asesor es ideal para sacar conclusiones rapidas sin navegar graficos o tablas. Preguntale y te da la respuesta directa con numeros",
        ],
        route: "/asesor",
        videoDurationFrames: 1050, // 35s x 30fps
      },
    ],
  },
];

// --- Helpers ---

export function getModuleById(id: string): GuideModule | undefined {
  return guideModules.find((m) => m.id === id);
}
