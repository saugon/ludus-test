import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShopperOrder } from '@vertex/storefront-sdk';
import { describe, expect, it } from 'vitest';
import { carrierDelivery, fakeStorefront, order, sdkError, signedIn } from '../test/fakes';
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
            order({ sale_number: 1043, fulfillment_status: 'ready' }),
            order({
              sale_number: 1042,
              fulfillment_status: 'picked_up',
              total: '95000.00',
              lines: [{ code: 'CP-ORK', name: 'Combat Patrol: Orks', quantity: 1, unit_price: '95000.00', total: '95000.00' }],
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
        shopper: { ...signedIn(), orders: async () => ({ orders: [order({ sale_number: 1043 }), order({ sale_number: 1042 })], nextCursor: null }) },
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
              sale_number: 1044,
              fulfillment_status: 'shipped',
              total: '198500.00',
              delivery: carrierDelivery({ status: 'created', tracking_number: '360000123456', tracking_url: 'https://andreani.example.com/360000123456' }),
            }),
            order({ sale_number: 1045, fulfillment_status: 'ready', delivery: carrierDelivery() }),
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
    const { delivery: _, ...legacy } = order({ sale_number: 1043, fulfillment_status: 'ready' });
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [legacy as ShopperOrder], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1043' });
    expect(screen.getByRole('link', { name: 'Pedido #1043, Listo para retirar' })).toHaveTextContent('Retiro');
    expect(within(detail).getByText(/Pasá a buscarlo por Olleros 3162/)).toBeInTheDocument();
    expect(detail).toHaveTextContent(/Retiro en el local\s*Gratis/);
  });

  it('shows an unpaid order without progress', async () => {
    renderStore(fakeStorefront({ shopper: { ...signedIn(), orders: async () => ({ orders: [order({ status: 'failed', fulfillment_status: null })], nextCursor: null }) } }), '/cuenta');

    const detail = await screen.findByRole('article', { name: 'Pedido #1042' });
    expect(within(detail).getByText('Pago no completado')).toBeInTheDocument();
    expect(within(detail).queryByRole('list', { name: 'Estado del pedido' })).not.toBeInTheDocument();
  });

  it('loads older orders from the next cursor', async () => {
    const storefront = fakeStorefront({ shopper: signedIn() });
    storefront.shopper.orders
      .mockResolvedValueOnce({ orders: [order({ sale_number: 1050 })], nextCursor: 'c-2' })
      .mockResolvedValueOnce({ orders: [order({ sale_number: 1001 })], nextCursor: null });
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
