import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Checkout } from '@vertex/storefront-sdk';
import { describe, expect, it } from 'vitest';
import { carrierDelivery, checkout, fakeStorefront, sdkError, signedIn, transferAccount } from '../test/fakes';
import { renderStore } from '../test/render';
import { DRAFT_KEY } from '../checkout/CheckoutProvider';

describe('the /pedido page', () => {
  it('confirms a paid checkout with its order number and the pickup address', async () => {
    const storefront = fakeStorefront({ resumeCheckout: async () => checkout('paid', { order_number: 1042 }) });
    renderStore(storefront, '/pedido');

    expect(await screen.findByRole('heading', { name: '¡Gracias por tu compra!' })).toBeInTheDocument();
    expect(screen.getByText('#1042')).toBeInTheDocument();
    expect(screen.getByText(/Retirá tu pedido en Olleros 3162/)).toBeInTheDocument();
    expect(storefront.resumeCheckout).toHaveBeenCalledTimes(1);
    expect(storefront.getCart).toHaveBeenCalledTimes(2);
  });

  it('takes a paid checkout without delivery, from a backend without home delivery, as a pickup', async () => {
    const { delivery: _, ...legacy } = checkout('paid', { order_number: 1042 });
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

  it('tells to pay cash when picking up a reserved order, before it expires', async () => {
    const reserved = checkout('awaiting_payment', { payment_method: 'cash', payment_url: null, expires_at: '2026-11-02T21:30:00Z' });
    renderStore(fakeStorefront({ resumeCheckout: async () => reserved }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'Tu pedido está reservado' })).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Plazo de la reserva' })).toHaveTextContent(
      /Tenés tiempo hasta las 18:30 del 2 nov para pasar a retirarlo y pagar .*95\.000 en efectivo\.Si no pasás para entonces, se pierde tu reserva\./,
    );
    expect(screen.getByText(/Retirá tu pedido en Olleros 3162/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Datos para transferir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Todavía no tenemos respuesta' })).not.toBeInTheDocument();
  });

  it('says a reserved order already has the payment method discount', async () => {
    const reserved = checkout('awaiting_payment', {
      payment_method: 'transfer',
      payment_url: null,
      transfer: transferAccount(),
      subtotal: '95000.00',
      discount: { percent: '10.00', amount: '9500.00' },
      total: '85500.00',
    });
    renderStore(fakeStorefront({ resumeCheckout: async () => reserved }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'Tu pedido está reservado' })).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Plazo de la reserva' })).toHaveTextContent(/transferirnos .*85\.500\..*Ya tiene el 10% de descuento por pagar con transferencia: te ahorrás .*9\.500\./);
  });

  it('says a transfer order was cancelled when the payment was not confirmed in time', async () => {
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('failed', { payment_method: 'transfer', transfer: transferAccount() }) }), '/pedido');

    expect(await screen.findByRole('heading', { name: 'El pedido se canceló' })).toBeInTheDocument();
    expect(screen.getByText(/No recibimos la transferencia a tiempo/)).toBeInTheDocument();
    // El carrito se soltó al reservar: no hay checkout al que volver.
    expect(screen.queryByRole('link', { name: 'Volver a intentar' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/productos');
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

  describe('without a session', () => {
    const purchase = () => sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name: 'Nico Paz', email: 'nico@example.com', phone: '', document: '' }));

    it('signs in with the email of the purchase right there, creating the account with its name, and opens Mis pedidos', async () => {
      purchase();
      const reserved = checkout('awaiting_payment', { payment_method: 'transfer', payment_url: null, transfer: transferAccount() });
      const storefront = fakeStorefront({ resumeCheckout: async () => reserved, shopper: { signIn: async () => ({ status: 'needs_name' }) } });
      renderStore(storefront, '/pedido');
      const user = userEvent.setup();

      const follow = await screen.findByRole('region', { name: 'Seguí tu pedido desde Mis pedidos' });
      expect(follow).toHaveTextContent('nico@example.com');
      await user.click(screen.getByRole('button', { name: 'Mandarme el código' }));
      expect(storefront.shopper.requestCode).toHaveBeenCalledWith('nico@example.com');

      await user.type(await screen.findByLabelText('Código'), '654321');

      expect(await screen.findByRole('heading', { name: /^Hola, Nico/ })).toBeInTheDocument();
      expect(storefront.shopper.completeSignUp).toHaveBeenCalledWith('Nico Paz');
    });

    it('still offers it after a reload, when the checkout already forgot the buyer', async () => {
      purchase();
      const paid = fakeStorefront({ resumeCheckout: async () => checkout('paid', { order_number: 1042 }) });
      const first = renderStore(paid, '/pedido');
      await screen.findByRole('heading', { name: '¡Gracias por tu compra!' });
      first.unmount();
      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();

      renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid', { order_number: 1042 }) }), '/pedido');

      expect(await screen.findByRole('region', { name: 'Seguí tu pedido desde Mis pedidos' })).toHaveTextContent('nico@example.com');
    });

    it('links to the sign-in page when the email of the purchase is unknown', async () => {
      renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid', { order_number: 1042 }) }), '/pedido');

      expect(await screen.findByRole('link', { name: 'Ingresá con el email de la compra' })).toHaveAttribute('href', '/ingresar?volver=%2Fcuenta');
    });
  });
});
