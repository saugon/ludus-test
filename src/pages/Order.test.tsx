import { screen } from '@testing-library/react';
import type { Checkout } from '@vertex/storefront-sdk';
import { describe, expect, it } from 'vitest';
import { carrierDelivery, checkout, fakeStorefront, sdkError, signedIn } from '../test/fakes';
import { renderStore } from '../test/render';

describe('the /pedido page', () => {
  it('confirms a paid checkout with its sale number and the pickup address', async () => {
    const storefront = fakeStorefront({ resumeCheckout: async () => checkout('paid', { sale_number: 1042 }) });
    renderStore(storefront, '/pedido');

    expect(await screen.findByRole('heading', { name: '¡Gracias por tu compra!' })).toBeInTheDocument();
    expect(screen.getByText('#1042')).toBeInTheDocument();
    expect(screen.getByText(/Retirá tu pedido en Olleros 3162/)).toBeInTheDocument();
    expect(storefront.resumeCheckout).toHaveBeenCalledTimes(1);
    expect(storefront.getCart).toHaveBeenCalledTimes(2);
  });

  it('takes a paid checkout without delivery, from a backend without home delivery, as a pickup', async () => {
    const { delivery: _, ...legacy } = checkout('paid', { sale_number: 1042 });
    renderStore(fakeStorefront({ resumeCheckout: async () => legacy as Checkout }), '/pedido');

    expect(await screen.findByRole('heading', { name: '¡Gracias por tu compra!' })).toBeInTheDocument();
    expect(screen.getByText(/Retirá tu pedido en Olleros 3162/)).toBeInTheDocument();
  });

  it('shows the delivery address and its cost for an order shipped home, without pickup', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid', { total: '103500.00', delivery: carrierDelivery() }) }), '/pedido');

    expect(await screen.findByRole('heading', { name: '¡Gracias por tu compra!' })).toBeInTheDocument();
    expect(screen.getByText(/Te lo enviamos a Av\. Corrientes 1234, piso 3, depto B, CABA \(CP 1043\)/)).toBeInTheDocument();
    expect(screen.getByText(/Pagaste .*103\.500, con .*8\.500 de envío/)).toBeInTheDocument();
    expect(screen.getByText(/Estamos registrando el envío/)).toBeInTheDocument();
    expect(screen.queryByText(/Retirá tu pedido/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Seguir envío' })).not.toBeInTheDocument();
  });

  it('links to the tracking page once the shipment is registered', async () => {
    const delivery = carrierDelivery({ status: 'created', tracking_number: '360000123456', tracking_url: 'https://andreani.example.com/360000123456' });
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid', { delivery }) }), '/pedido');

    expect(await screen.findByRole('link', { name: 'Seguir envío' })).toHaveAttribute('href', 'https://andreani.example.com/360000123456');
    expect(screen.getByText('360000123456')).toBeInTheDocument();
  });

  it('offers a retry when the payment failed or expired, keeping the cart', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('failed') }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'El pago no se completó' })).toBeInTheDocument();
    expect(screen.getByText(/tu carrito sigue guardado/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a intentar' })).toHaveAttribute('href', '/checkout');
  });

  it('says the store will get in touch when the checkout needs attention', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('attention') }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'Estamos revisando tu pago' })).toBeInTheDocument();
    expect(screen.getByText(/Te vamos a contactar/)).toBeInTheDocument();
  });

  it('explains there is nothing to resume without a saved checkout', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => null }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'No hay un pago en curso' })).toBeInTheDocument();
  });

  it('lets the buyer check again when the payment is still pending after polling', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('approved') }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'Todavía no tenemos respuesta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a consultar' })).toBeInTheDocument();
  });

  it('shows the mapped error when resuming fails', async () => {
    renderStore(
      fakeStorefront({
        resumeCheckout: async () => {
          throw sdkError('timeout', null);
        },
      }),
      '/pedido',
    );

    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a intentar' })).toBeInTheDocument();
  });

  it('takes a signed-in buyer to their orders after paying', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid'), shopper: signedIn() }), '/pedido');

    expect(await screen.findByRole('link', { name: 'Ver mis pedidos' })).toHaveAttribute('href', '/cuenta');
    expect(screen.queryByRole('link', { name: 'Ingresá con el email de la compra' })).not.toBeInTheDocument();
  });

  it('invites a guest to sign in to follow the pickup', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid') }), '/pedido');

    expect(await screen.findByRole('link', { name: 'Ingresá con el email de la compra' })).toHaveAttribute('href', '/ingresar?volver=%2Fcuenta');
  });

  it('does not invite a buyer to sign in while their session is still being checked', async () => {
    const storefront = fakeStorefront({ resumeCheckout: async () => checkout('paid'), shopper: { isSignedIn: () => true } });
    storefront.shopper.get.mockImplementation(() => new Promise(() => {}));
    renderStore(storefront, '/pedido');

    await screen.findByRole('heading', { name: '¡Gracias por tu compra!' });
    expect(screen.queryByRole('link', { name: 'Ingresá con el email de la compra' })).not.toBeInTheDocument();
  });
});
