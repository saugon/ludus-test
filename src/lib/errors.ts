import { StorefrontError } from '@vertex/storefront-sdk';
import { CONFIG_VARS } from '../config';

export type ShortLine = { code: string; requested: number; available: number };

export type ErrorKind = 'stock' | 'input' | 'cart' | 'payment' | 'delivery' | 'busy' | 'config' | 'session' | 'offline' | 'unknown';

// Dónde pasó el error, para los códigos que significan otra cosa según el pedido:
// - quote: la cotización del envío (getDeliveryOptions).
// - delivery: un checkout con envío a domicilio.
export type ErrorContext = 'quote' | 'delivery';

export type ErrorView = {
  kind: ErrorKind;
  title: string;
  message: string;
  hint?: string;
  retry: boolean;
  lines: ShortLine[];
};

const configHint = (what: string) => `Revisá ${what} en el archivo .env.local y reiniciá la tienda.`;

function seconds(value: number): string {
  return value === 1 ? '1 segundo' : `${value} segundos`;
}

function describeQuoteError(error: StorefrontError): ErrorView | null {
  switch (error.code) {
    case 'rate_limited':
      return {
        kind: 'busy',
        title: 'Demasiadas cotizaciones seguidas',
        message: `Cotizaste muchas veces en poco tiempo. Esperá ${error.retryAfter ? seconds(Math.ceil(error.retryAfter)) : 'un minuto'} y volvé a cotizar; la dirección queda cargada.`,
        retry: true,
        lines: [],
      };
    case 'validation_error':
      return {
        kind: 'input',
        title: 'Revisá la dirección',
        message: 'Hay datos de la dirección que no son válidos. Revisá la calle, el número, el código postal de 4 dígitos, la ciudad y la provincia.',
        retry: false,
        lines: [],
      };
    case 'not_found':
      return {
        kind: 'delivery',
        title: 'Por ahora no hacemos envíos',
        message: 'Podés retirar tu compra en el local.',
        retry: false,
        lines: [],
      };
    case 'provider_unavailable':
    case 'service_unavailable':
    case 'internal_error':
      return {
        kind: 'delivery',
        title: 'No pudimos cotizar el envío',
        message: 'Probá de nuevo en unos minutos, o elegí retirar en el local.',
        retry: true,
        lines: [],
      };
    default:
      return null;
  }
}

export function describeError(error: unknown, names: Record<string, string> = {}, context?: ErrorContext): ErrorView {
  if (!(error instanceof StorefrontError)) {
    return {
      kind: 'unknown',
      title: 'Algo salió mal',
      message: 'No pudimos completar la acción. Probá de nuevo en un momento.',
      retry: true,
      lines: [],
    };
  }

  const inContext = context === 'quote' ? describeQuoteError(error) : null;
  if (inContext) return inContext;

  switch (error.code) {
    case 'insufficient_stock': {
      const detail = error.lines
        .map((line) => {
          const name = names[line.code] ?? line.code;
          return line.available > 0
            ? `${name}: pediste ${line.requested} y quedan ${line.available}.`
            : `${name}: se agotó.`;
        })
        .join(' ');
      return {
        kind: 'stock',
        title: 'No hay stock suficiente',
        message: detail || 'Algunos productos ya no tienen la cantidad que pediste.',
        hint: 'Ajustá las cantidades y volvé a intentar.',
        retry: false,
        lines: error.lines,
      };
    }
    case 'validation_error':
      return {
        kind: 'input',
        title: 'Revisá los datos',
        message:
          context === 'delivery'
            ? 'Hay datos que no son válidos. Revisá tu nombre, tu email, el teléfono y el DNI.'
            : 'Hay datos que no son válidos. Revisá tu nombre, tu email y las cantidades del carrito.',
        retry: false,
        lines: [],
      };
    case 'checkout_in_progress':
      return {
        kind: 'busy',
        title: 'Ya hay un pago en curso',
        message:
          'Este carrito tiene un pago abierto. Terminalo en la ventana de pago o esperá a que venza para volver a intentar. Mientras tanto no se puede cambiar el carrito ni la forma de entrega.',
        retry: true,
        lines: [],
      };
    case 'shipping_quote_expired':
      return {
        kind: 'delivery',
        title: 'La cotización del envío venció',
        message: 'El precio del envío vale 30 minutos y se vuelve a calcular si cambia el carrito. Cotizá de nuevo: tu dirección sigue cargada.',
        retry: false,
        lines: [],
      };
    case 'cart_closed':
      return {
        kind: 'cart',
        title: 'Este carrito ya se cerró',
        message: 'El carrito ya se pagó o dejó de estar disponible. Empezá uno nuevo para seguir comprando.',
        retry: false,
        lines: [],
      };
    case 'provider_unavailable':
    case 'service_unavailable':
      return {
        kind: 'payment',
        title: 'El pago no está disponible',
        message: 'No podemos procesar pagos en este momento. Probá de nuevo en unos minutos; tu carrito queda guardado.',
        retry: true,
        lines: [],
      };
    case 'rate_limited':
      return {
        kind: 'busy',
        title: 'Demasiados intentos seguidos',
        message: 'Esperá unos segundos y volvé a intentar.',
        retry: true,
        lines: [],
      };
    case 'invalid_code':
      return {
        kind: 'input',
        title: 'El código no sirve',
        message: 'El código está mal, venció o ya se usó. Revisalo o pedí uno nuevo.',
        retry: false,
        lines: [],
      };
    case 'too_many_attempts':
      return {
        kind: 'busy',
        title: 'Demasiados intentos',
        message: 'Ese código se probó demasiadas veces y dejó de funcionar. Pedí uno nuevo.',
        retry: false,
        lines: [],
      };
    case 'shopper_unauthorized':
      return {
        kind: 'session',
        title: 'Tu sesión venció',
        message: 'Volvé a ingresar con tu email para seguir.',
        retry: false,
        lines: [],
      };
    case 'unauthorized':
      return {
        kind: 'config',
        title: 'La tienda no está bien configurada',
        message: 'La API rechazó la clave de la tienda.',
        hint: configHint(`que ${CONFIG_VARS.publishableKey} sea una clave publicable vigente, con los permisos read:catalog, write:carts, write:checkouts y write:shoppers`),
        retry: false,
        lines: [],
      };
    case 'forbidden':
    case 'insufficient_scope':
    case 'api_access_disabled':
      return {
        kind: 'config',
        title: 'La tienda no está bien configurada',
        message: 'La clave no tiene permiso para esta acción, o la API está deshabilitada para el comercio.',
        hint: configHint(`los permisos de la clave de ${CONFIG_VARS.publishableKey}, que su lista de orígenes incluya esta dirección y que la venta online esté habilitada para el local`),
        retry: false,
        lines: [],
      };
    case 'not_found':
      return {
        kind: 'config',
        title: 'No encontramos la tienda',
        message: 'La API no reconoce el local o la dirección configurada.',
        hint: configHint(`${CONFIG_VARS.venue} (el slug del local) y ${CONFIG_VARS.baseUrl}`),
        retry: false,
        lines: [],
      };
    case 'invalid_key':
      return {
        kind: 'config',
        title: 'La clave de la tienda no es publicable',
        message: 'La tienda solo puede usar claves publicables, que empiezan con rst_pk_.',
        hint: configHint(CONFIG_VARS.publishableKey),
        retry: false,
        lines: [],
      };
    case 'timeout':
      return {
        kind: 'offline',
        title: 'Sin conexión',
        message: 'No pudimos comunicarnos con la tienda. Revisá tu conexión a internet y volvé a intentar.',
        retry: true,
        lines: [],
      };
    default:
      return {
        kind: 'unknown',
        title: 'Algo salió mal',
        message: 'No pudimos completar la acción. Probá de nuevo en un momento.',
        retry: true,
        lines: [],
      };
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof StorefrontError && error.code === 'not_found';
}
