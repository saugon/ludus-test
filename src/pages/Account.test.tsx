import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShopperOrder } from '@vertex/storefront-sdk';
import { describe, expect, it } from 'vitest';
import { carrierDelivery, fakeStorefront, order, paymentMethods, product, sdkError, signedIn } from '../test/fakes';
import { renderStore } from '../test/render';

function currentStep(detail: HTMLElement) {
  return within(within(detail).getByRole('list', { name: 'Estado del pedido' })).getByText(
    (_, element) => element?.tagName === 'LI' && element.getAttribute('aria-current') === 'step',
  );
}

describe('the /cuenta page', () => {
  it('sends a guest to sign in and back', async () => {
    renderStore(fakeStorefront(), '/cuenta');

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('lists the orders and shows the first one in detail, with its progress, pickup and lines', async () => {
    const storefront = fakeStorefront({
      shopper: {
        ...signedIn(),
        orders: async () => ({
          orders: [
            order({ order_number: 1043, fulfillment_status: 'ready' }),
            order({
              order_number: 1042,
              fulfillment_status: 'picked_up',
              total: '95000.00',
              lines: [{ code: 'CP-ORK', name: 'Combat Patrol: Orks', quantity: 1, unit_price: '95000.00', total: '95000.00', presale: false }],
            }),
          ],
          nextCursor: null,
        }),
      },
    });
    renderStore(storefront, '/cuenta');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(await screen.findByText('2 pedidos')).toBeInTheDocument();
    const list = screen.getByRole('navigation', { name: 'Tus pedidos' });
    expect(within(list).getByRole('link', { name: 'Pedido #1043, Listo para retirar' })).toHaveAttribute('aria-current', 'true');
    expect(within(list).getByRole('link', { name: 'Pedido #1042, Retirado' })).toHaveTextContent('Retiro');

    const first = screen.getByRole('article', { name: 'Pedido #1043' });
    expect(within(first).getByText(/Pasá a buscarlo por Olleros 3162/)).toBeInTheDocument();
    expect(currentStep(first)).toHaveTextContent('Listo para retirar');
    expect(within(first).getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(first).toHaveTextContent('Cantidad: 2 · $ 95.000 c/u');
    expect(first).toHaveTextContent(/Retiro en el local\s*Gratis/);
    expect(within(first).getByRole('link', { name: '¿Problemas con el pedido?' })).toHaveAttribute('href', expect.stringContaining('pedido%20%231043'));

    await user.click(within(list).getByRole('link', { name: 'Pedido #1042, Retirado' }));

    const second = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(currentStep(second)).toHaveTextContent('Retirado');
    expect(second).toHaveTextContent(/Total\s*\$\s*95\.000/);
    expect(within(list).getByRole('link', { name: 'Pedido #1042, Retirado' })).toHaveAttribute('aria-current', 'true');
    expect(storefront.shopper.orders).toHaveBeenCalledWith({ limit: 10, cursor: null });
  });

  it('opens the order named in the address', async () => {
    renderStore(
      fakeStorefront({
        shopper: { ...signedIn(), orders: async () => ({ orders: [order({ order_number: 1043 }), order({ order_number: 1042 })], nextCursor: null }) },
      }),
      '/cuenta?pedido=1042',
    );

    expect(await screen.findByRole('article', { name: 'Pedido #1042' })).toBeInTheDocument();
  });

  it('shows where an order ships, what the shipping cost and how to follow it', async () => {
    const storefront = fakeStorefront({
      shopper: {
        ...signedIn(),
        orders: async () => ({
          orders: [
            order({
              order_number: 1044,
              fulfillment_status: 'shipped',
              total: '198500.00',
              delivery: carrierDelivery({ status: 'created', tracking_number: '360000123456', tracking_url: 'https://andreani.example.com/360000123456' }),
            }),
            order({ order_number: 1045, fulfillment_status: 'ready', delivery: carrierDelivery() }),
          ],
          nextCursor: null,
        }),
      },
    });
    renderStore(storefront, '/cuenta');
    const user = userEvent.setup();

    const shipped = await screen.findByRole('article', { name: 'Pedido #1044' });
    expect(currentStep(shipped)).toHaveTextContent('En camino');
    expect(within(shipped).getByText('Av. Corrientes 1234, piso 3, depto B, CABA (CP 1043)')).toBeInTheDocument();
    expect(shipped).toHaveTextContent(/Envío a domicilio\s*\$\s*8\.500/);
    expect(within(shipped).getByText('Registrado en el transporte')).toBeInTheDocument();
    expect(within(shipped).getByText('N.º 360000123456')).toBeInTheDocument();
    expect(within(shipped).getByRole('link', { name: /Seguir envío/ })).toHaveAttribute('href', 'https://andreani.example.com/360000123456');
    expect(shipped).not.toHaveTextContent(/retir/i);
    expect(screen.getByRole('link', { name: 'Pedido #1044, En camino' })).toHaveTextContent('Envío');

    await user.click(screen.getByRole('link', { name: 'Pedido #1045, Listo para despachar' }));

    const ready = await screen.findByRole('article', { name: 'Pedido #1045' });
    expect(currentStep(ready)).toHaveTextContent('En preparación');
    expect(within(ready).getByText('Registrando el envío')).toBeInTheDocument();
    expect(within(ready).queryByRole('link', { name: /Seguir envío/ })).not.toBeInTheDocument();
    expect(ready).not.toHaveTextContent(/Olleros/);
  });

  it('shows orders without delivery, from a backend without home delivery, as pickups', async () => {
    const { delivery: _, ...legacy } = order({ order_number: 1043, fulfillment_status: 'ready' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [legacy as ShopperOrder], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1043' });
    expect(screen.getByRole('link', { name: 'Pedido #1043, Listo para retirar' })).toHaveTextContent('Retiro');
    expect(within(detail).getByText(/Pasá a buscarlo por Olleros 3162/)).toBeInTheDocument();
    expect(detail).toHaveTextContent(/Retiro en el local\s*Gratis/);
  });

  it('flags the lines bought on presale, with the date while the product is still on presale', async () => {
    const year = new Date().getFullYear();
    const line = { name: 'x', quantity: 1, unit_price: '1000.00', total: '1000.00' };
    renderStore(
      fakeStorefront({
        products: [
          product({ code: 'WS', presale: true, presale_available_on: `${year}-12-25` }),
          product({ code: 'LIB' }),
          product({ code: 'ALI', presale: true }),
        ],
        shopper: {
          ...signedIn(),
          orders: async () => ({
            orders: [
              order({
                presale: true,
                lines: [
                  { ...line, code: 'WS', name: 'Warspear', presale: true },
                  { ...line, code: 'LIB', name: 'Liberadores', presale: true },
                  { ...line, code: 'ALI', name: 'Alicates', presale: false },
                ],
              }),
            ],
            nextCursor: null,
          }),
        },
      }),
      '/cuenta',
    );

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    // Sigue en preventa: con la fecha del catálogo.
    expect(await within(detail).findByText('Preventa · llegada estimada el 25 de diciembre')).toBeInTheDocument();
    // Ya no está en preventa: el pedido igual recuerda que lo fue.
    expect(within(detail).getByText('Preventa')).toBeInTheDocument();
    // En preventa ahora, pero no cuando se compró: nada.
    expect(within(detail).getAllByText(/^Preventa/)).toHaveLength(2);
  });

  it('shows an unpaid order without progress', async () => {
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [order({ status: 'failed', fulfillment_status: null })], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('Pago no completado')).toBeInTheDocument();
    expect(within(detail).queryByRole('list', { name: 'Estado del pedido' })).not.toBeInTheDocument();
  });

  it('shows an order awaiting its transfer with the account to transfer to and when it expires', async () => {
    const waiting = order({ status: 'awaiting_payment', fulfillment_status: null, sale_number: null, payment_method: 'transfer', created_at: '2026-11-04T18:00:00Z' });
    // El local reserva las transferencias 48 horas: el plazo sale de ahí, no de un valor fijo.
    const methods = paymentMethods().map((method) => (method.method === 'transfer' ? { ...method, hold_hours: 48 } : method));
    renderStore(fakeStorefront({ getPaymentMethods: async () => methods, shopper: { ...signedIn(), orders: async () => ({ orders: [waiting], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('Esperando la transferencia')).toBeInTheDocument();
    expect(await within(detail).findByRole('region', { name: 'Datos para transferir' })).toHaveTextContent('Aliasludus.games.mp');
    expect(detail).toHaveTextContent('Se cancela si no se confirma el pago antes de las 15:00 del 6 nov.');
    expect(within(detail).getByText('Medio de pago').nextElementSibling).toHaveTextContent('Transferencia bancaria');
  });

  it('names Mercado Pago as the payment method of an order paid with it, without the transfer account', async () => {
    const paid = order({ payment_method: 'mercadopago' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [paid], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('Medio de pago').nextElementSibling).toHaveTextContent('Mercado Pago');
    expect(within(detail).queryByRole('region', { name: 'Datos para transferir' })).not.toBeInTheDocument();
  });

  it('shows the discount the payment method took off the order', async () => {
    const waiting = order({
      status: 'awaiting_payment',
      fulfillment_status: null,
      sale_number: null,
      payment_method: 'cash',
      subtotal: '190000.00',
      discount: { percent: '15.00', amount: '28500.00' },
      total: '161500.00',
    });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [waiting], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('Descuento 15% · efectivo').nextElementSibling?.textContent).toMatch(/−.*28\.500/);
    expect(within(detail).getByText('Total').nextElementSibling?.textContent).toMatch(/161\.500/);
  });

  it('names an order by its number in the store, before it is paid and has a sale', async () => {
    const waiting = order({ status: 'awaiting_payment', fulfillment_status: null, sale_number: null, order_number: 5, payment_method: 'cash' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [waiting], nextCursor: null }) } }), '/cuenta');

    expect(await screen.findByRole('article', { name: 'Pedido #5' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /¿Problemas con el pedido\?/ }).getAttribute('href')).toContain(encodeURIComponent('pedido #5'));
  });

  it('falls back to the sale number for an order placed before orders were numbered, and to no number without either', async () => {
    const legacy = order({ order_number: null, sale_number: 980 });
    const bare = order({ order_number: null, sale_number: null, status: 'awaiting_payment', fulfillment_status: null, payment_method: 'cash' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [legacy, bare], nextCursor: null }) } }), '/cuenta');

    expect(await screen.findByRole('article', { name: 'Pedido #980' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pedido sin número/ })).toBeInTheDocument();
  });

  it('shows the discount code the order used', async () => {
    const coded = order({ subtotal: '190000.00', discount_code: { code: 'BIENVENIDA10', amount: '19000.00' }, total: '171000.00' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [coded], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('Código BIENVENIDA10').nextElementSibling?.textContent).toMatch(/−.*19\.000/);
    expect(within(detail).getByText('Total').nextElementSibling?.textContent).toMatch(/171\.000/);
  });

  it('shows a cash order as ready to pay when picking up', async () => {
    const waiting = order({ status: 'awaiting_payment', fulfillment_status: null, sale_number: null, payment_method: 'cash' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [waiting], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('A pagar al retirar')).toBeInTheDocument();
    expect(detail).toHaveTextContent('Pasá a retirarlo por Olleros 3162, CABA y pagalo en efectivo');
    expect(within(detail).queryByRole('region', { name: 'Datos para transferir' })).not.toBeInTheDocument();
  });

  it('loads older orders from the next cursor', async () => {
    const storefront = fakeStorefront({ shopper: signedIn() });
    storefront.shopper.orders
      .mockResolvedValueOnce({ orders: [order({ order_number: 1050 })], nextCursor: 'c-2' })
      .mockResolvedValueOnce({ orders: [order({ order_number: 1001 })], nextCursor: null });
    renderStore(storefront, '/cuenta');
    const user = userEvent.setup();

    expect(await screen.findByText('1+ pedidos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver pedidos anteriores' }));

    expect(await screen.findByRole('link', { name: /Pedido #1001/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pedido #1050/ })).toBeInTheDocument();
    expect(screen.getByText('2 pedidos')).toBeInTheDocument();
    expect(storefront.shopper.orders).toHaveBeenLastCalledWith({ limit: 10, cursor: 'c-2' });
    expect(screen.queryByRole('button', { name: 'Ver pedidos anteriores' })).not.toBeInTheDocument();
  });

  it('explains where orders come from when there are none', async () => {
    renderStore(fakeStorefront({ shopper: signedIn() }), '/cuenta');

    expect(await screen.findByText('Todavía no tenés pedidos')).toBeInTheDocument();
    expect(screen.getByText(/las que pagaste con este email sin ingresar/)).toBeInTheDocument();
  });

  it('shows the account data, read only, in its own tab', async () => {
    renderStore(fakeStorefront({ shopper: signedIn() }), '/cuenta');
    const user = userEvent.setup();

    expect(await screen.findByRole('tab', { name: 'Mis pedidos' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Mis datos' }));

    const panel = screen.getByRole('tabpanel', { name: 'Mis datos' });
    expect(panel).toHaveTextContent('Ana Gómez');
    expect(panel).toHaveTextContent('ana@example.com');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('asks to sign in again when the session expired', async () => {
    const storefront = fakeStorefront({
      shopper: {
        ...signedIn(),
        orders: async () => {
          throw sdkError('shopper_unauthorized', 401);
        },
      },
    });
    renderStore(storefront, '/cuenta');

    expect(await screen.findByText('Tu sesión venció. Ingresá de nuevo con tu email.')).toBeInTheDocument();
    expect(storefront.shopper.signOut).toHaveBeenCalled();
  });

  it('signs out and goes home', async () => {
    const storefront = fakeStorefront({ shopper: signedIn() });
    renderStore(storefront, '/cuenta');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(storefront.shopper.signOut).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /Hola/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/cuenta');
  });
});
