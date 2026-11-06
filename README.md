# Ludus Game Store

Tienda online de Ludus: catálogo, carrito, pago con Openpay, envío a domicilio con Andreani y cuenta del cliente con sus pedidos, todo a través de la API externa de Vertex usando `@vertex/storefront-sdk`. Retirar en el local es la opción por defecto; el envío a domicilio aparece si el local tiene Andreani conectado.

Stack: Vite, React, TypeScript y Tailwind CSS v4. El SDK se instala desde su tarball en `vendor/`, igual que lo haría cualquier cliente.

```bash
npm install
npm run dev        # http://localhost:5200 (puerto fijo, --strictPort)
npm test           # tests unitarios (Vitest, con el SDK mockeado)
npm run typecheck
npm run build      # genera dist/
```

Si falta alguna variable, la tienda no se rompe: muestra la pantalla **Tienda sin configurar** con la lista de las variables que faltan.

## Conectar la tienda

La tienda lee tres variables de entorno, más una opcional para apagar el envío a domicilio. No hay ninguna clave ni dirección escrita en el código.

1. Copiá `.env.example` a `.env.local`. Git ignora `.env.local`.
2. Completá las variables:

   | Variable | Qué es | En local |
   |---|---|---|
   | `VITE_STOREFRONT_BASE_URL` | La base de la API externa de Vertex, sin `/v1` | `http://localhost:4010/api/external` |
   | `VITE_STOREFRONT_VENUE` | El slug del local que vende | el slug del venue |
   | `VITE_STOREFRONT_KEY` | Una clave **publicable** del local (`rst_pk_...`) | |
   | `VITE_HOME_DELIVERY` | Opcional. `off` oculta el envío a domicilio y deja solo el retiro | sin definir (encendido) |

3. La clave publicable tiene que cumplir dos condiciones:
   - Tener los permisos `read:catalog`, `write:carts`, `write:checkouts` y `write:shoppers`. Sin el último, la tienda vende igual, pero falla el ingreso a la cuenta.
   - Tener en `allowed_origins` **exactamente** el origen de la tienda: `http://localhost:5200`. Tiene que decir `localhost`, no `127.0.0.1`: para el navegador son orígenes distintos, y la API rechaza el que no está en la lista. Por eso el servidor de desarrollo usa siempre el puerto 5200.
4. Reiniciá `npm run dev`. Vite lee el `.env.local` solo al arrancar.

Si algo de la configuración está mal, la tienda lo dice en pantalla:
- **Clave rechazada:** `unauthorized`.
- **Faltan permisos u orígenes:** `forbidden` o `insufficient_scope`.
- **Slug o base incorrectos:** `not_found`.
- **La clave no empieza con `rst_pk_`:** `invalid_key`.

## Casos para probar punta a punta

El checkout de Openpay en local es un fake con tres botones: **Aprobar**, **Rechazar** y **Dejar vencer**.

1. **Compra aprobada.** Agregá productos y recorré los tres pasos: **Carrito**, **Envío** (nombre, email y retiro) y **Pago**, donde revisás todo y pagás. En el fake tocá **Aprobar**. Volvés a `/pedido`, que muestra «¡Gracias por tu compra!» con el número de pedido (`sale_number`) y la dirección de retiro. El carrito queda vacío.
2. **Rechazo y reintento.** Tocá **Rechazar**. Como en Openpay real, no volvés a la tienda: el fake muestra «Pago rechazado. Podés intentar de nuevo.» y la orden sigue abierta. Tocá **Aprobar** en la misma página y termina como el caso 1.
3. **Rechazo que no se reintenta.** Tocá **Rechazar** y después **Dejar vencer**: la orden vence y volvés a `/pedido` con «El pago no se completó». El carrito se conserva y **Volver a intentar** te lleva al paso Carrito; en Envío siguen tus datos y, si era con envío, la misma dirección ya cotizada. Si en vez de eso volvés a la tienda sin tocar nada, `/pedido` espera el pago hasta 2 minutos y muestra «Todavía no tenemos respuesta».
4. **Más que el stock.** Sumá al carrito más unidades de las que hay. Por ejemplo, editá un producto en Vertex después de agregarlo para dejarle menos stock. Al pagar, la API responde `insufficient_stock`. La tienda marca cada línea corta con «Quedan N» y ofrece **Ajustar al stock disponible**; hasta que lo corrijas, no se puede pagar.

El estado `attention` (lo resuelve el comercio) muestra «Estamos revisando tu pago» y un acceso a WhatsApp.

### Cuenta del cliente

En local, los emails con el código no salen: quedan en el mailbox de desarrollo del backend, http://localhost:4010/dev/mailbox.

5. **Cuenta nueva desde el checkout.** Con algo en el carrito, en el paso **Envío** tocá **Ingresá**. Poné un email que no tenga cuenta, copiá el código del mailbox y completá el nombre. Volvés al paso Envío con «Comprás como …» y sin formulario; la entrega que habías elegido sigue ahí. Al pagar, el pedido aparece en **Mis pedidos**.
6. **Cuenta existente.** Ingresá desde el ícono de la cuenta, arriba a la derecha, con un email que ya tenga cuenta. Entra directo, sin pedir el nombre, y te lleva a `/cuenta`.
7. **Código equivocado.** Un código incorrecto borra el campo y dice «El código está mal o ya venció». Después de cinco intentos el código deja de servir (`too_many_attempts`): el campo se bloquea y queda solo **Pedir un código nuevo**.
8. **Reenvío.** El backend acepta un código por email por minuto. La pantalla muestra la cuenta regresiva, y si volvés a poner el mismo email antes de que pase el minuto, reusa el código ya enviado en vez de pedir otro.
9. **Compra como invitado.** Pagá sin ingresar, con un email. Después ingresá con ese email: el pedido aparece en tu cuenta igual, porque el backend suma los pedidos pagados con el email de la cuenta.
10. **Sesión vencida.** Borrá o cambiá a mano `vertex-storefront:<venue>:shopper` en `localStorage`. Pagar o abrir `/cuenta` lleva a ingresar de nuevo con «Tu sesión venció».
11. **Estado del retiro.** Desde Ecommerce en Vertex, marcá el pedido como listo o retirado. En **Mis pedidos** la etiqueta cambia a «Listo para retirar» (con la dirección) o «Retirado».

### Envío a domicilio

Para que aparezca el envío, el local tiene que tener el flag `ecommerce_shipping` encendido y Andreani conectado en Tienda online. En local, Andreani es el mock de `tools/andreani-mock` de Vertex (puerto 8970): en Gestionero, en Tienda online del local, conectá Andreani con cualquier usuario y contraseña, un código postal de origen de 4 dígitos, un CUIT válido (por ejemplo `20123456786`) y el bulto por unidad.

12. **Envío aprobado.** En el paso **Envío** elegí **Envío a domicilio**, completá la dirección y la tienda cotiza sola apenas están calle, altura, código postal, ciudad y provincia (y de nuevo si cambiás la dirección o el carrito). Aparece Andreani con su precio y, si viene, el plazo. Completá teléfono y DNI: el resumen ya suma el envío. En **Pago** revisá la dirección y la entrega. Pagá y aprobá. `/pedido` muestra la dirección y el costo del envío; cuando Vertex registra el envío aparece **Seguir envío**.
13. **Dirección sin cobertura.** Usá el código postal `9999`: la tienda dice «Andreani no llega a esta dirección» y ofrece **Retirar en el local**.
14. **Andreani caído.** Apagá el mock de Andreani y completá una dirección: «El envío con Andreani no está disponible en este momento». La API igual responde 200, con el retiro solo.
15. **Cotización vencida.** La cotización vale 30 minutos y se invalida si cambia el carrito. Al pagar con una vencida, la API responde `shipping_quote_expired`: la tienda vuelve al paso Envío, pide cotizar de nuevo y conserva la dirección. Si cambiás la dirección o el carrito después de cotizar, la tienda pide cotizar de nuevo antes de dejarte pagar.
16. **Demasiadas cotizaciones.** Más de 10 por carrito y por minuto responden 429. La tienda no repite la cotización de una dirección ya cotizada, así que hay que cambiar muchas veces de dirección para llegar. El SDK reintenta solo si la espera es corta; si igual falla, la tienda dice cuántos segundos esperar y no reintenta sola.
17. **Local sin envíos.** Con `ecommerce_shipping` apagado, cotizar responde 404: la tienda deja solo el retiro y el carrito sigue intacto.
18. **Pago abierto con otra entrega.** Empezá un pago con retiro, volvé sin pagar y probá pagar con envío: la API responde `checkout_in_progress` hasta que el primero se pague o venza.
19. **Despacho y entrega.** En **Mis pedidos**, un pedido con envío muestra la dirección, el costo, el estado del registro en Andreani y, cuando está registrado, el número y **Seguir envío**. Desde Ecommerce en Vertex marcalo listo («Listo para despachar») y despachado («En camino»). Para entregarlo, `curl -X POST http://127.0.0.1:8970/__mock__/shipments/<número>/deliver` y en Ecommerce **Actualizar seguimiento**: la etiqueta pasa a «Entregado».

Para forzar un envío que no se registra, reconectá Andreani con el usuario `lost` (el registro queda incierto) o `rejected` (Andreani lo rechaza). En **Mis pedidos** el estado del envío dice «No se pudo registrar; lo estamos resolviendo». Si el registro ya falló cuando el comprador vuelve a `/pedido`, la tienda dice «Tuvimos un problema al registrar el envío».

## Contenido para completar

Los textos y datos del local están en un solo archivo, `src/content.ts`. Antes de publicar:

- [ ] **`whatsappNumber`**: hoy es un placeholder (`5491100000000`). Va en formato internacional, sin `+` ni espacios. Lo usan todos los botones de WhatsApp: encargos, reservar mesa y contacto.
- [ ] **`tournaments`**: es un texto genérico. Confirmá qué torneos o ligas hay y cómo anotarse.
- [ ] **`tables`** (17), **`hours`** y **`address`**: copiados de la web anterior. Confirmá que estén al día.
- [ ] **`featuredCodes`**: los códigos de los productos destacados. Si queda vacío, se muestran los primeros productos con stock.
- [ ] **`og:image`** en `index.html`: cambiá `/og.jpg` por la URL absoluta del dominio (`https://<dominio>/og.jpg`). WhatsApp e Instagram no resuelven rutas relativas.

Los encargos salen del catálogo: cada producto con `status: out_of_stock` aparece como **Por encargo**, con un botón que abre WhatsApp con el nombre del producto ya escrito.

## Cómo está armado

- `src/App.tsx`: valida la configuración, crea el storefront una sola vez y arma las rutas: `/`, `/productos`, `/productos/:code`, los pasos de la compra (`/checkout`, `/checkout/envio` y `/checkout/pago`), `/pedido` y una 404.
- `src/checkout/`: la compra en tres pasos.
  - **Carrito** (`CartStep`): las líneas editables y el subtotal.
  - **Envío** (`ShippingStep`): los datos del comprador (o la cuenta) y la entrega.
  - **Pago** (`PaymentStep`): revisa datos y entrega, llama a `checkout()` y lleva a Openpay. Si falta algo del paso anterior, vuelve a Envío.
  - `CheckoutProvider` guarda lo completado mientras se navega entre pasos, incluso al pasar por `/ingresar`.
  - Pagar en Openpay recarga la página, así que para reintentar un pago sin escribir todo de nuevo:
    - El nombre y el email del invitado, el teléfono y el DNI se guardan en `sessionStorage` (`ludus:checkout`) mientras dura la compra. La API no los devuelve a propósito. Se borran al volver con el pedido pagado y al cerrar la pestaña.
    - La dirección no se guarda: si `/pedido` vuelve con un checkout `failed` con envío, la tienda carga `checkout.delivery.address` en el paso Envío y la vuelve a cotizar sola. Si ya había otra dirección escrita, no la pisa.
  - El resumen de la derecha (`Summary`) muestra productos, entrega y total, con el botón para seguir.
- `src/cart/CartProvider.tsx`: el estado del carrito.
  - Al cargar llama a `getCart()`; el SDK guarda el token en `localStorage` por venue, así que el carrito sobrevive a recargar la página.
  - Cada cambio arma la lista completa de líneas y llama a `setCartLines()`.
  - Las escrituras van en fila, así dos clicks rápidos se suman en vez de pisarse.
  - La respuesta del servidor es la única fuente de verdad: no hay estado optimista.
  - Las cantidades se limitan a `max_quantity`.
- `src/lib/errors.ts`: traduce cada código de `StorefrontError` a un título, un mensaje y, si es un problema de configuración, qué revisar. Con el contexto `quote`, los errores de la cotización hablan del envío: un `not_found` ahí no es la configuración, es que el local no hace envíos.
- `src/delivery/`: la elección de entrega del checkout.
  - `DeliveryChoice.tsx`: Retiro o Envío a domicilio, el formulario de la dirección, la cotización con `getDeliveryOptions()` y el teléfono y DNI de la opción elegida.
  - La cotización sale sola 700 ms después del último cambio, cuando la dirección está completa, y queda atada a esa dirección y a las líneas del carrito. Si cambia cualquiera de las dos, vuelve a cotizar sola. Hay una sola cotización en curso a la vez, y no se repite una dirección ya cotizada (tampoco después de un error: ahí está **Cotizar de nuevo**).
  - `address.ts`: las 24 provincias (salen del tipo del SDK), las validaciones de la dirección, el teléfono y el DNI, y cómo se escribe una dirección.
- `src/shopper/ShopperProvider.tsx`: la sesión del cliente.
  - El SDK guarda el token en `localStorage` por venue y la sesión dura 7 días.
  - Al cargar, si hay token, llama a `shopper.get()`. Si la API responde `shopper_unauthorized`, el SDK borra el token y la tienda pasa a invitado con el aviso «Tu sesión venció».
  - Si otra pestaña ingresa o cierra sesión, esta se entera por el evento `storage`.
- `src/pages/SignIn.tsx` (`/ingresar`): email, código y nombre si es la primera vez. Vuelve a `?volver=`, que solo acepta rutas de la tienda.
- `src/pages/Account.tsx` (`/cuenta`): dos pestañas, **Mis pedidos** y **Mis datos** (`?seccion=datos`).
  - **Mis pedidos:** la lista a la izquierda (de a 10, del más nuevo al más viejo, con **Ver pedidos anteriores**) y el detalle del elegido a la derecha. El elegido va en `?pedido=<número>`, así el link se comparte y «atrás» vuelve al anterior. En el celular el detalle va debajo de la lista y al elegir un pedido se baja hasta él.
  - El detalle (`src/components/OrderDetail.tsx`) muestra el estado con una barra de progreso (Pagado, En preparación, Listo para retirar o En camino, Retirado o Entregado), el retiro o el envío con su seguimiento, los productos y los totales, y un acceso a WhatsApp por si hay un problema.
  - No hay un endpoint de detalle: el detalle se arma con lo que trae el listado, que incluye `delivery` igual que el checkout.
  - **Mis datos** muestra el nombre y el email, sin edición: la API todavía no la permite (#4543).
  - `src/shopper/orderStatus.ts` combina el estado del pago con el de la entrega en una etiqueta y calcula el progreso.
- Con sesión, el paso Envío no pide nombre ni email: el backend usa los de la cuenta. Si la sesión venció al pagar, el paso Pago ofrece ingresar de nuevo o comprar sin cuenta.
- El comprador no puede cancelar ni modificar un pedido desde la tienda, ni editar su perfil. Eso todavía no existe en la API (#4543).
- `src/lib/storefront.tsx`: el catálogo se pide una vez y se comparte entre páginas. El navegador lo cachea 30 s; la tienda no intenta saltear ese caché.

## Para producción

### En GitHub Pages

El workflow `.github/workflows/deploy.yml` corre los tests, compila y publica en cada push a `main` (o a mano, desde Actions → **Publicar en GitHub Pages** → Run workflow).

1. En el repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. En **Settings → Secrets and variables → Actions → Variables**, definí:

   | Variable | Valor |
   |---|---|
   | `VITE_STOREFRONT_BASE_URL` | la base de la API externa de producción, sin `/v1` |
   | `VITE_STOREFRONT_VENUE` | el slug del local real |
   | `VITE_STOREFRONT_KEY` | la clave publicable de producción (`rst_pk_...`) |
   | `VITE_HOME_DELIVERY` | opcional: sin definir queda `off`; poné `on` cuando producción tenga el envío con Andreani |
   | `BASE_PATH` | opcional: sin definir es `/<nombre del repo>/`; con dominio propio, `/` |

3. En Vertex, la clave publicable tiene que tener en `allowed_origins` el origen de Pages, sin el path: `https://<usuario>.github.io`.
4. Hacé push a `main` y esperá el workflow. La tienda queda en `https://<usuario>.github.io/<repo>/`.

La tienda lee el subpath de la base de Vite (`src/lib/paths.ts`): las rutas, las imágenes de `public/` y la dirección de vuelta de Openpay (`/<repo>/pedido`) lo incluyen. GitHub Pages no reescribe rutas, así que el workflow copia `index.html` a `404.html`: al recargar `/pedido` o volver de Openpay, Pages responde con la tienda (con status 404, que el navegador muestra igual).

### En otro servidor

**Contra un Vertex sin envío a domicilio.** Mientras producción no tenga el envío con Andreani (#4542), compilá con `VITE_HOME_DELIVERY=off`: la tienda ofrece solo el retiro y no intenta cotizar. Sin la variable funciona igual, pero muestra «Envío a domicilio» y recién al cotizar dice que no hay envíos. Los pedidos y checkouts que ese backend devuelve sin `delivery` se muestran como retiros, así que `/pedido` y **Mis pedidos** funcionan con los dos.

**Solo cambian las tres variables** (y `VITE_HOME_DELIVERY`, si hace falta):
- la base de la API externa de producción;
- el slug del local real;
- una clave publicable de producción que tenga en `allowed_origins` el origen exacto de la tienda, por ejemplo `https://tienda.ludus.com.ar`.

Las variables `VITE_*` se fijan **al compilar**, así que hay que definirlas antes de `npm run build`.

**Del lado de Vertex, antes tiene que estar:**
- la épica de ecommerce desplegada;
- el flag `ecommerce` encendido para el local;
- Openpay conectado con las credenciales reales;
- para ofrecer envíos, el flag `ecommerce_shipping` encendido y Andreani conectado en Tienda online con la cuenta real (sin eso, la tienda ofrece solo el retiro);
- los productos publicados en la tienda.

**Es un sitio estático.** Se compila con `npm run build` y se sirve `dist/` con fallback a `index.html`, para que funcionen `/pedido` y el resto de las rutas al recargar.

Recomendaciones para el servidor (vienen de la revisión técnica de la web anterior):

- **Comprimir** con gzip o brotli. El JS pesa unos 100 KB comprimido.
- **Caché:** `Cache-Control: public, max-age=31536000, immutable` para `/assets/*`, que tienen hash en el nombre, y `no-cache` para `index.html`.
- **Headers de seguridad** en el sitio, no solo en la API:
  - `Content-Security-Policy: frame-ancestors 'none'`, o `X-Frame-Options: DENY`, para que el checkout no se pueda embeber en otro sitio;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - HSTS.
- **404:** con el fallback, cualquier URL responde 200 y la tienda muestra su propia página de «Página no encontrada». Si se necesita un 404 real para SEO, el servidor tiene que conocer las rutas válidas.

Ejemplo con Caddy:

```caddy
tienda.ludus.com.ar {
	root * /srv/ludus/dist
	encode zstd gzip
	header {
		Content-Security-Policy "frame-ancestors 'none'"
		X-Frame-Options DENY
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}
	@assets path /assets/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	header /index.html Cache-Control "no-cache"
	try_files {path} /index.html
	file_server
}
```

**Imágenes:** las fotos propias del sitio (hero y local) están en WebP en varios tamaños. Las de los productos vienen de Vertex (`image_url`); conviene subirlas en un tamaño razonable, alrededor de 800 px de lado.
