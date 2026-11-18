import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { andreaniOption, cart, carrierDelivery, checkout, codeRefusal, deliveryOptions, fakeStorefront, paymentMethods, sdkError, signedIn, transferAccount, withCode } from '../test/fakes';
import { cartStorageKey } from '../cart/CartProvider';
import { renderStore, VENUE } from '../test/render';
import { DRAFT_KEY, validateBuyer } from './CheckoutProvider';

const saved = cart([{ code: 'CP-ORK', quantity: 3, price: 95000, max: 5 }]);
const address = { street: 'Av. Corrientes', number: '1234', floor: '3', apartment: 'B', postal_code: '1043', city: 'CABA', province: 'CABA' } as const;

type User = ReturnType<typeof userEvent.setup>;

async function continueToShipping(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Continuar al envío' }));
  await screen.findByRole('heading', { name: 'Datos y envío' });
}

async function fillBuyer(user: User) {
  await user.type(await screen.findByLabelText('Nombre y apellido'), 'Ana Gómez');
  await user.type(screen.getByLabelText('Email'), 'ana@example.com');
}

async function continueToPayment(user: User) {
  await user.click(screen.getByRole('button', { name: /Continuar al pago/ }));
  await screen.findByRole('heading', { name: 'Revisá y pagá' });
}

async function chooseHomeDelivery(user: User) {
  await user.click(await screen.findByRole('radio', { name: /Envío a domicilio/ }));
  await user.type(screen.getByLabelText('Calle'), address.street);
  await user.type(screen.getByLabelText('Altura'), address.number);
  await user.type(screen.getByLabelText(/^Piso/), address.floor);
  await user.type(screen.getByLabelText(/^Depto/), address.apartment);
  await user.type(screen.getByLabelText('Código postal'), address.postal_code);
  await user.selectOptions(screen.getByLabelText('Provincia'), 'CABA');
}

async function quoteAndChooseAndreani(user: User) {
  await chooseHomeDelivery(user);
  await screen.findByRole('radio', { name: /Andreani a domicilio/ });
  await user.type(screen.getByLabelText('Teléfono'), '11 2345 6789');
  await user.type(screen.getByLabelText('DNI'), '30.123.456');
}

function summaryTotal() {
  return within(screen.getByRole('complementary')).getByText('Total').nextElementSibling?.textContent;
}

function currentStep() {
  return within(screen.getByRole('navigation', { name: 'Pasos de la compra' })).getByText((_, element) => element?.getAttribute('aria-current') === 'step');
}

describe('validateBuyer', () => {
  it('asks for a name and a well-formed email', () => {
    expect(validateBuyer({ name: ' ', email: 'ana@' })).toEqual({
      name: 'Escribí tu nombre y apellido.',
      email: 'Escribí un email válido, por ejemplo nombre@gmail.com.',
    });
    expect(validateBuyer({ name: 'Ana', email: 'ana@example.com' })).toEqual({});
  });
});

describe('the cart step', () => {
  it('shows the cart with its products and total, and goes on to shipping', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Tu carrito' })).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent('Carrito');
    expect(screen.getByRole('group', { name: 'Cantidad de Producto CP-ORK' })).toBeInTheDocument();
    expect(screen.getByText('En el paso siguiente')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).getAllByText(/285\.000/).length).toBeGreaterThan(0);

    await continueToShipping(user);
    expect(currentStep()).toHaveTextContent('Envío');
  });

  it('does not go on while a product needs fixing', async () => {
    renderStore(fakeStorefront({ getCart: async () => cart([{ code: 'CP-ORK', quantity: 1, status: 'out_of_stock' }]) }), '/checkout');

    expect(await screen.findByRole('button', { name: 'Continuar al envío' })).toBeDisabled();
    expect(screen.getByText('Corregí los productos marcados para seguir.')).toBeInTheDocument();
  });

  it('starts a new cart when the saved one became a transfer order, as with a paid one', async () => {
    const reserved = { ...saved, checkout: { status: 'awaiting_payment', payment_method: 'transfer', payment_url: null, expires_at: '2026-11-02T21:30:00Z', order_number: 7 } } as const;
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(fakeStorefront({ getCart: async () => reserved }), '/checkout');

    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
    expect(localStorage.getItem(cartStorageKey(VENUE))).toBeNull();
  });

  it.each(['paid', 'approved'] as const)('starts a new cart when the saved one was %s without going through /pedido', async (status) => {
    // Quien pagó con Mercado Pago y no volvió a la tienda: el SDK no llegó a olvidar el carrito, que la API ya cerró.
    const sold = { ...saved, checkout: { status, payment_method: 'mercadopago', payment_url: null, expires_at: '2026-11-02T21:30:00Z', order_number: 7 } } as const;
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(fakeStorefront({ getCart: async () => sold }), '/checkout');

    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
    expect(localStorage.getItem(cartStorageKey(VENUE))).toBeNull();
  });

  it('keeps a cart whose online payment is still open', async () => {
    const open = { ...saved, checkout: { status: 'awaiting_payment', payment_method: 'mercadopago', payment_url: 'https://pay.example.com/1', expires_at: '2026-11-02T21:30:00Z', order_number: 7 } } as const;
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(fakeStorefront({ getCart: async () => open }), '/checkout');

    expect(await screen.findByRole('heading', { name: 'Tu carrito' })).toBeInTheDocument();
    expect(localStorage.getItem(cartStorageKey(VENUE))).toBe('tok');
  });

  it('says the cart is empty', async () => {
    renderStore(fakeStorefront(), '/checkout');

    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
  });
});

describe('the shipping step', () => {
  it('picks up at the store by default', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/envio');

    expect(await screen.findByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Envío a domicilio/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Retiro en el local/ }).closest('label')).toHaveTextContent('Olleros 3162');
    expect(screen.getByText(/Retirás cuando el pago esté aprobado/)).toBeInTheDocument();
  });

  it('does not go on until the buyer data is valid', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Continuar al pago/ }));

    expect(screen.getByText('Escribí tu nombre y apellido.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nombre y apellido')).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Datos y envío' })).toBeInTheDocument();
  });

  it('offers a guest to sign in and come back to this step', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/envio');

    expect(await screen.findByRole('link', { name: 'Ingresá' })).toHaveAttribute('href', '/ingresar?volver=%2Fcheckout%2Fenvio');
  });

  it('lets a signed-in shopper go on without typing their data', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved, shopper: signedIn() }), '/checkout/envio');
    const user = userEvent.setup();

    expect(await screen.findByRole('region', { name: 'Comprás como Ana Gómez' })).toHaveTextContent('ana@example.com');
    expect(screen.queryByLabelText('Nombre y apellido')).not.toBeInTheDocument();
    await continueToPayment(user);
  });

  it('quotes by itself once the address is complete, and shows the options with price and time', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await chooseHomeDelivery(user);
    expect(screen.getByLabelText('Ciudad o localidad')).toHaveValue('CABA');
    expect(screen.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();
    expect(screen.getByText('Cotizando el envío…')).toBeInTheDocument();

    const option = await screen.findByRole('radio', { name: /Andreani a domicilio/ });
    expect(storefront.getDeliveryOptions).toHaveBeenCalledTimes(1);
    expect(storefront.getDeliveryOptions).toHaveBeenCalledWith(address);
    expect(option).toBeChecked();
    expect(within(option.closest('label')!).getByText(/8\.500/)).toBeInTheDocument();
    expect(screen.getByText('Llega en 3 días aprox.')).toBeInTheDocument();
    expect(within(option.closest('label')!).getByText('Av. Corrientes 1234, piso 3, depto B · CABA (CP 1043)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled();
    expect(summaryTotal()).toMatch(/293\.500/);
  });

  it('asks for the phone and DNI before going on with home delivery', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await chooseHomeDelivery(user);
    await screen.findByRole('radio', { name: /Andreani a domicilio/ });
    await user.click(screen.getByRole('button', { name: /Continuar al pago/ }));

    expect(screen.getByText(/Escribí un teléfono/)).toBeInTheDocument();
    expect(screen.getByText('Escribí tu DNI, de 7 u 8 números.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Datos y envío' })).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveFocus();

    await user.type(screen.getByLabelText('Teléfono'), '1123456789');
    await user.click(screen.getByRole('button', { name: /Continuar al pago/ }));
    expect(screen.getByLabelText('DNI')).toHaveFocus();
  });

  it('does not quote an incomplete address, and says what is wrong when leaving a field', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: /Envío a domicilio/ }));
    expect(screen.getByText(/Completá calle, altura, código postal, ciudad y provincia/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Calle'), 'Av. Corrientes');
    await user.type(screen.getByLabelText('Altura'), '1234');
    await user.type(screen.getByLabelText('Código postal'), '123');
    await user.tab();
    await user.selectOptions(screen.getByLabelText('Provincia'), 'CABA');

    expect(screen.getByText('El código postal tiene 4 dígitos, por ejemplo 1425.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(storefront.getDeliveryOptions).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Código postal'), '4');
    expect(await screen.findByRole('radio', { name: /Andreani a domicilio/ })).toBeInTheDocument();
    expect(storefront.getDeliveryOptions).toHaveBeenCalledWith({ street: 'Av. Corrientes', number: '1234', postal_code: '1234', city: 'CABA', province: 'CABA' });
  });

  it('says in plain words when Andreani does not reach the address', async () => {
    renderStore(
      fakeStorefront({
        getCart: async () => saved,
        getDeliveryOptions: async () => deliveryOptions([], [{ carrier: 'andreani', reason: 'address_not_served' }]),
      }),
      '/checkout/envio',
    );
    const user = userEvent.setup();

    await chooseHomeDelivery(user);

    expect(await screen.findByText(/Andreani no llega a esta dirección/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retirar en el local' }));
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Continuar al pago/ })).toBeEnabled();
  });

  it('explains when the carrier is not available right now', async () => {
    renderStore(
      fakeStorefront({ getCart: async () => saved, getDeliveryOptions: async () => deliveryOptions([], [{ carrier: 'andreani', reason: 'carrier_unavailable' }]) }),
      '/checkout/envio',
    );
    const user = userEvent.setup();

    await chooseHomeDelivery(user);

    expect(await screen.findByText(/El envío con Andreani no está disponible en este momento/)).toBeInTheDocument();
  });

  it('offers one option per connected carrier and lets the shopper choose Correo Argentino', async () => {
    const correo = andreaniOption({ code: 'quote-2', carrier: 'correo_argentino', name: 'Correo Argentino Clásico', price: '7302.50', delivery_days: 5 });
    const storefront = fakeStorefront({ getCart: async () => saved, getDeliveryOptions: async () => deliveryOptions([andreaniOption(), correo]) });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await chooseHomeDelivery(user);
    const options = within(await screen.findByRole('radiogroup', { name: 'Opciones de envío' }));
    expect(options.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['quote-1', 'quote-2']);
    // Con más de una, ninguna viene elegida: la elige quien compra.
    expect(options.getByRole('radio', { name: /Andreani a domicilio/ })).not.toBeChecked();
    expect(options.getByRole('radio', { name: /Correo Argentino Clásico/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();

    await user.click(options.getByRole('radio', { name: /Correo Argentino Clásico/ }));
    expect(screen.getByText('Correo Argentino los usa para avisarte y entregar el paquete.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Teléfono'), '11 2345 6789');
    await user.type(screen.getByLabelText('DNI'), '30.123.456');
    // 285.000 de productos y 7.302,50 de Correo Argentino.
    expect(summaryTotal()).toMatch(/292\.302,50/);
    await continueToPayment(user);
    expect(screen.getByText(/Correo Argentino Clásico/)).toBeInTheDocument();
  });

  it('keeps the other carrier when one does not reach the address, without sending the shopper to pickup', async () => {
    renderStore(
      fakeStorefront({
        getCart: async () => saved,
        getDeliveryOptions: async () => deliveryOptions([andreaniOption()], [{ carrier: 'correo_argentino', reason: 'address_not_served' }]),
      }),
      '/checkout/envio',
    );
    const user = userEvent.setup();

    await chooseHomeDelivery(user);

    expect(await screen.findByText('Correo Argentino no llega a esta dirección.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Andreani a domicilio/ })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Retirar en el local' })).not.toBeInTheDocument();
  });

  it('offers only pickup when the store does not ship, and keeps the cart', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      getDeliveryOptions: async () => {
        throw sdkError('not_found', 404);
      },
    });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await chooseHomeDelivery(user);

    expect(await screen.findByText(/Por ahora no hacemos envíos a domicilio/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Envío a domicilio/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(screen.queryByText('No encontramos la tienda')).not.toBeInTheDocument();
    expect(screen.getByText('Producto CP-ORK')).toBeInTheDocument();
    expect(storefront.setCartLines).not.toHaveBeenCalled();
  });

  it('offers only pickup, without quoting, when home delivery is off in the config', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved });
    renderStore(storefront, '/checkout/envio', { homeDelivery: false });

    expect(await screen.findByText(/Por ahora no hacemos envíos a domicilio/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Envío a domicilio/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(storefront.getDeliveryOptions).not.toHaveBeenCalled();
  });

  it('tells how long to wait after too many quotes, without retrying by itself', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      getDeliveryOptions: async () => {
        throw sdkError('rate_limited', 429, [], 42);
      },
    });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await chooseHomeDelivery(user);

    expect(await screen.findByText('Demasiadas cotizaciones seguidas')).toBeInTheDocument();
    expect(screen.getByText(/Esperá 42 segundos/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(storefront.getDeliveryOptions).toHaveBeenCalledTimes(1);
  });

  it('quotes again by itself when the address changes after quoting', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await chooseHomeDelivery(user);
    await screen.findByRole('radio', { name: /Andreani a domicilio/ });
    storefront.getDeliveryOptions.mockResolvedValueOnce(deliveryOptions([andreaniOption({ code: 'quote-2', price: '9100.00' })]));

    await user.type(screen.getByLabelText('Altura'), '0');

    expect(screen.queryByRole('radio', { name: /Andreani a domicilio/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();
    await waitFor(() => expect(summaryTotal()).toMatch(/294\.100/));
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled();
    expect(storefront.getDeliveryOptions).toHaveBeenCalledTimes(2);
    expect(storefront.getDeliveryOptions).toHaveBeenLastCalledWith({ ...address, number: '12340' });
  });
});

describe('the payment step', () => {
  it('sends back to the shipping step when its data is missing', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/pago');

    expect(await screen.findByRole('heading', { name: 'Datos y envío' })).toBeInTheDocument();
  });

  it('reviews the data and pickup, and pays returning to /pedido', async () => {
    const started = checkout('awaiting_payment');
    const storefront = fakeStorefront({ getCart: async () => saved, checkout: async () => started });
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await fillBuyer(user);
    await continueToPayment(user);

    expect(currentStep()).toHaveTextContent('Pago');
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('Retiro en el local · Gratis')).toBeInTheDocument();
    const payment = screen.getByRole('region', { name: 'Pago' });
    expect(within(payment).getByRole('radio', { name: /Openpay/ })).toBeChecked();
    expect(payment).toHaveTextContent('Te llevamos a Openpay para pagar y volvés acá con tu número de pedido.');
    expect(screen.getByRole('link', { name: 'Cambiar contacto' })).toHaveAttribute('href', '/checkout/envio');

    await user.click(screen.getByRole('button', { name: /Pagar .*285\.000/ }));

    await waitFor(() => expect(storefront.redirectToPayment).toHaveBeenCalledWith(started));
    expect(storefront.checkout).toHaveBeenCalledWith({
      name: 'Ana Gómez',
      email: 'ana@example.com',
      returnUrl: `${window.location.origin}/pedido`,
    });
  });

  it('offers the methods the store takes and reserves a transfer order, showing the account on /pedido', async () => {
    const reserved = checkout('awaiting_payment', { payment_method: 'transfer', payment_url: null, transfer: transferAccount() });
    let placed = false;
    const storefront = fakeStorefront({
      // Después del checkout, el carrito guardado trae el pedido reservado.
      getCart: async () => (placed ? { ...saved, checkout: { status: 'awaiting_payment', payment_method: 'transfer', payment_url: null, expires_at: reserved.expires_at, order_number: 7 } } : saved),
      getPaymentMethods: async () => paymentMethods(),
      checkout: async () => {
        placed = true;
        return reserved;
      },
      resumeCheckout: async () => reserved,
      shopper: signedIn(),
    });
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await continueToPayment(user);

    const payment = screen.getByRole('region', { name: 'Pago' });
    expect(within(payment).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['openpay', 'transfer', 'cash']);
    expect(within(payment).getByRole('radio', { name: /Openpay/ })).toBeChecked();
    // Cada medio dice cuánto reserva el pedido, como lo fija el local.
    expect(within(payment).getByRole('radio', { name: /Transferencia bancaria/ })).toHaveAccessibleName(/Te reservamos el pedido 24 horas para que transfieras/);
    expect(within(payment).getByRole('radio', { name: /Efectivo/ })).toHaveAccessibleName(/Te lo reservamos 24 horas/);

    await user.click(within(payment).getByRole('radio', { name: /Transferencia bancaria/ }));
    await user.click(screen.getByRole('button', { name: /Confirmar pedido .*285\.000/ }));

    expect(await screen.findByRole('heading', { name: 'Tu pedido está reservado' })).toBeInTheDocument();
    expect(storefront.checkout).toHaveBeenCalledWith({
      returnUrl: `${window.location.origin}/pedido`,
      paymentMethod: 'transfer',
    });
    expect(storefront.redirectToPayment).not.toHaveBeenCalled();
    const account = screen.getByRole('region', { name: 'Datos para transferir' });
    expect(account).toHaveTextContent('Aliasludus.games.mp');
    expect(account).toHaveTextContent('TitularLudus SRL');
    expect(within(account).getByRole('link', { name: /Mandanos el comprobante/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/.+comprobante/));
    // La compra está hecha, como una pagada: ese carrito queda con el pedido y se sigue con uno nuevo.
    await waitFor(() => expect(localStorage.getItem(cartStorageKey(VENUE))).toBeNull());
  });

  it('shows the discount of each method and takes the chosen one off the products, before the shipping', async () => {
    // El local descuenta 10% con transferencia; Openpay y efectivo, nada.
    const discounted = cart([{ code: 'CP-ORK', quantity: 3, price: 95000, max: 5 }], 'cart-1', { openpay: null, transfer: 10, cash: null });
    const methods = paymentMethods().map((method) => (method.method === 'transfer' ? { ...method, discount_percent: '10.00' } : method));
    renderStore(fakeStorefront({ getCart: async () => discounted, getPaymentMethods: async () => methods }), '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await quoteAndChooseAndreani(user);
    // En el paso Envío todavía no se eligió el medio: el total no tiene descuento.
    expect(summaryTotal()).toMatch(/293\.500/);
    await continueToPayment(user);

    const payment = screen.getByRole('region', { name: 'Pago' });
    expect(within(payment).getByRole('radio', { name: /Transferencia bancaria/ })).toHaveAccessibleName(/10% OFF/);
    expect(within(payment).getByRole('radio', { name: /Openpay/ })).not.toHaveAccessibleName(/OFF/);
    const summary = screen.getByRole('complementary');
    expect(within(summary).queryByText(/Descuento/)).not.toBeInTheDocument();
    expect(summaryTotal()).toMatch(/293\.500/);

    await user.click(within(payment).getByRole('radio', { name: /Transferencia bancaria/ }));
    expect(within(summary).getByText('Descuento 10% · transferencia').nextElementSibling?.textContent).toMatch(/−.*28\.500/);
    // 285.000 − 28.500 de los productos, más 8.500 del envío.
    expect(summaryTotal()).toMatch(/265\.000/);
    expect(screen.getByRole('button', { name: /Confirmar pedido .*265\.000/ })).toBeInTheDocument();
  });

  it('pays cash only when picking up', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved, getPaymentMethods: async () => paymentMethods() }), '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await quoteAndChooseAndreani(user);
    await continueToPayment(user);

    const payment = screen.getByRole('region', { name: 'Pago' });
    expect(within(payment).queryByRole('radio', { name: /Efectivo/ })).not.toBeInTheDocument();
    expect(payment).not.toHaveTextContent('sólo para retirar en el local');
  });

  it('offers only Openpay, without sending a payment method, to a backend without offline payments', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved, getPaymentMethods: async () => Promise.reject(sdkError('not_found', 404)) });
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await fillBuyer(user);
    await continueToPayment(user);

    expect(await within(screen.getByRole('region', { name: 'Pago' })).findByRole('radio', { name: /Openpay/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /Pagar .*285\.000/ }));
    await waitFor(() => expect(storefront.checkout).toHaveBeenCalledWith({ name: 'Ana Gómez', email: 'ana@example.com', returnUrl: `${window.location.origin}/pedido` }));
  });

  it('lets a guest pay with Mercado Pago, sending the method and going to its payment page', async () => {
    const started = checkout('awaiting_payment', { payment_method: 'mercadopago', payment_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' });
    const [openpay, ...offline] = paymentMethods();
    const methods = [openpay, { method: 'mercadopago' as const, pickup_only: false, transfer: null, hold_hours: null, discount_percent: null }, ...offline];
    const storefront = fakeStorefront({ getCart: async () => saved, getPaymentMethods: async () => methods, checkout: async () => started });
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await fillBuyer(user);
    await continueToPayment(user);

    const payment = screen.getByRole('region', { name: 'Pago' });
    expect(within(payment).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['openpay', 'mercadopago', 'transfer', 'cash']);
    const mercadopago = within(payment).getByRole('radio', { name: /^Mercado Pago/ });
    expect(mercadopago).toHaveAccessibleName(/volvés acá con tu número de pedido/);
    // Como Openpay, el logo va en lugar del nombre.
    expect(within(mercadopago.closest('label')!).getByRole('img', { name: 'Mercado Pago' })).toBeInTheDocument();
    await user.click(mercadopago);
    // Como Openpay, no pide cuenta: un invitado paga con Mercado Pago.
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByText('Los datos de pago los cargás en Mercado Pago: la tienda no los ve ni los guarda.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pagar .*285\.000/ }));

    await waitFor(() => expect(storefront.redirectToPayment).toHaveBeenCalledWith(started));
    expect(storefront.checkout).toHaveBeenCalledWith({ name: 'Ana Gómez', email: 'ana@example.com', returnUrl: `${window.location.origin}/pedido`, paymentMethod: 'mercadopago' });
  });

  it('asks a guest to sign in before reserving a transfer or cash order, which only shoppers with an account can place', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved, getPaymentMethods: async () => paymentMethods() });
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await fillBuyer(user);
    await continueToPayment(user);
    // Con Openpay, un invitado paga sin cuenta.
    expect(screen.getByRole('button', { name: /Pagar .*285\.000/ })).toBeEnabled();

    await user.click(screen.getByRole('radio', { name: /Transferencia bancaria/ }));
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Para pagar por transferencia tenés que ingresar con tu email.');
    expect(within(note).getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar?volver=%2Fcheckout%2Fpago');
    expect(screen.getByRole('button', { name: /Confirmar pedido/ })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Efectivo/ }));
    expect(screen.getByRole('note')).toHaveTextContent('Para pagar en efectivo tenés que ingresar con tu email.');
    expect(storefront.checkout).not.toHaveBeenCalled();
  });

  it('asks for another method when the store stopped taking the chosen one', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      checkout: async () => Promise.reject(sdkError('validation_error', 422)),
      shopper: signedIn(),
    });
    storefront.getPaymentMethods.mockResolvedValueOnce(paymentMethods()).mockResolvedValue([{ method: 'openpay', pickup_only: false, transfer: null, hold_hours: null, discount_percent: null }]);
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await continueToPayment(user);
    await user.click(screen.getByRole('radio', { name: /Transferencia bancaria/ }));
    await user.click(screen.getByRole('button', { name: /Confirmar pedido/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El local dejó de aceptar transferencia bancaria. Elegí otro medio de pago.');
    expect(screen.queryByRole('radio', { name: /Transferencia/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Openpay/ })).toBeChecked();
  });

  it('pays a home delivery with the chosen option, phone and DNI, and the shipping in the total', async () => {
    const started = checkout('awaiting_payment', { delivery: carrierDelivery(), total: '293500.00' });
    const storefront = fakeStorefront({ getCart: async () => saved, checkout: async () => started });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await quoteAndChooseAndreani(user);
    await continueToPayment(user);

    expect(screen.getByText('Av. Corrientes 1234, piso 3, depto B, CABA (CP 1043)')).toBeInTheDocument();
    expect(screen.getByText('Tel. 11 2345 6789 · DNI 30.123.456')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pagar .*293\.500/ }));

    await waitFor(() => expect(storefront.redirectToPayment).toHaveBeenCalledWith(started));
    expect(storefront.checkout).toHaveBeenCalledWith({
      name: 'Ana Gómez',
      email: 'ana@example.com',
      returnUrl: `${window.location.origin}/pedido`,
      delivery: { option: 'quote-1', phone: '11 2345 6789', document: '30.123.456' },
    });
  });

  it('keeps what was typed when going back a step', async () => {
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await quoteAndChooseAndreani(user);
    await continueToPayment(user);
    await user.click(screen.getByRole('link', { name: 'Volver al envío' }));

    expect(await screen.findByLabelText('Nombre y apellido')).toHaveValue('Ana Gómez');
    expect(screen.getByLabelText('Calle')).toHaveValue('Av. Corrientes');
    expect(screen.getByRole('radio', { name: /Andreani a domicilio/ })).toBeChecked();
    expect(screen.getByLabelText('DNI')).toHaveValue('30.123.456');
  });

  it('sends back to quote again, keeping the address, when the quote expired', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      checkout: async () => {
        throw sdkError('shipping_quote_expired', 409);
      },
    });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await quoteAndChooseAndreani(user);
    await continueToPayment(user);
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(await screen.findByText('La cotización del envío venció')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Datos y envío' })).toBeInTheDocument();
    expect(screen.getByLabelText('Calle')).toHaveValue('Av. Corrientes');
    expect(screen.getByLabelText('Código postal')).toHaveValue('1043');
    expect(screen.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();

    storefront.getDeliveryOptions.mockResolvedValueOnce(deliveryOptions([andreaniOption({ code: 'quote-2', price: '9000.00' })]));
    await user.click(screen.getByRole('button', { name: 'Cotizar de nuevo' }));

    expect(storefront.getDeliveryOptions).toHaveBeenLastCalledWith(address);
    await waitFor(() => expect(summaryTotal()).toMatch(/294\.000/));
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled();
    expect(screen.getByLabelText('Teléfono')).toHaveValue('11 2345 6789');
  });

  it('shows what is left on insufficient_stock and sends to the cart to adjust', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      checkout: async () => {
        throw sdkError('insufficient_stock', 409, [{ code: 'CP-ORK', requested: 3, available: 1 }]);
      },
    });
    renderStore(storefront, '/checkout/envio');
    const user = userEvent.setup();

    await fillBuyer(user);
    await continueToPayment(user);
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('No hay stock suficiente')).toBeInTheDocument();
    expect(within(alert).getByText('Producto CP-ORK: pediste 3 y quedan 1.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagar/ })).toBeDisabled();

    await user.click(within(alert).getByRole('link', { name: 'Ajustar en el carrito' }));
    expect(await screen.findByText('Quedan 1.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajustar al stock disponible' }));

    expect(storefront.setCartLines).toHaveBeenLastCalledWith([{ code: 'CP-ORK', quantity: 1 }]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar al envío' })).toBeEnabled());
  });

  it('points to the payment status when a checkout is already in progress', async () => {
    renderStore(
      fakeStorefront({
        getCart: async () => saved,
        checkout: async () => {
          throw sdkError('checkout_in_progress', 409);
        },
        shopper: signedIn(),
      }),
      '/checkout/pago',
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Pagar/ }));

    expect(await screen.findByText('Ya hay un pago en curso')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el estado del pago' })).toHaveAttribute('href', '/pedido');
  });

  it('lets a signed-in shopper pay without typing their data', async () => {
    const started = checkout('awaiting_payment');
    const storefront = fakeStorefront({ getCart: async () => saved, checkout: async () => started, shopper: signedIn() });
    renderStore(storefront, '/checkout/pago');
    const user = userEvent.setup();

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    await waitFor(() => expect(storefront.redirectToPayment).toHaveBeenCalledWith(started));
    expect(storefront.checkout).toHaveBeenCalledWith({ returnUrl: `${window.location.origin}/pedido` });
  });

  it('offers to sign in again or buy as a guest when the session expired at payment', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      checkout: async () => {
        throw sdkError('shopper_unauthorized', 401);
      },
      shopper: signedIn(),
    });
    renderStore(storefront, '/checkout/pago');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Pagar/ }));

    expect(await screen.findByText('Tu sesión venció')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingresar de nuevo' })).toHaveAttribute('href', '/ingresar?volver=%2Fcheckout%2Fpago');
    expect(storefront.shopper.signOut).toHaveBeenCalled();

    await user.click(screen.getByRole('link', { name: 'Comprar sin cuenta' }));
    expect(await screen.findByLabelText('Nombre y apellido')).toBeInTheDocument();
  });
});

describe('retrying a payment that did not go through', () => {
  it('starts the shipping step with the address of the failed checkout and quotes it again', async () => {
    const storefront = fakeStorefront({
      getCart: async () => saved,
      resumeCheckout: async () => checkout('failed', { delivery: carrierDelivery() }),
    });
    renderStore(storefront, '/pedido');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: 'Volver a intentar' }));
    await continueToShipping(user);

    expect(screen.getByRole('radio', { name: /Envío a domicilio/ })).toBeChecked();
    expect(screen.getByLabelText('Calle')).toHaveValue('Av. Corrientes');
    expect(screen.getByLabelText('Piso')).toHaveValue('3');
    expect(screen.getByLabelText('Código postal')).toHaveValue('1043');
    expect(screen.getByLabelText('Provincia')).toHaveValue('CABA');
    expect(await screen.findByRole('radio', { name: /Andreani a domicilio/ })).toBeChecked();
    expect(storefront.getDeliveryOptions).toHaveBeenCalledWith(address);
  });

  it('keeps the guest data, phone and DNI in sessionStorage across a reload, and not the address', async () => {
    const first = renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/envio');
    const user = userEvent.setup();
    await fillBuyer(user);
    await quoteAndChooseAndreani(user);

    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toEqual({
      name: 'Ana Gómez',
      email: 'ana@example.com',
      phone: '11 2345 6789',
      document: '30.123.456',
    });

    first.unmount();
    renderStore(fakeStorefront({ getCart: async () => saved }), '/checkout/envio');

    expect(await screen.findByLabelText('Nombre y apellido')).toHaveValue('Ana Gómez');
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
    await chooseHomeDelivery(user);
    await screen.findByRole('radio', { name: /Andreani a domicilio/ });
    expect(screen.getByLabelText('Teléfono')).toHaveValue('11 2345 6789');
    expect(screen.getByLabelText('DNI')).toHaveValue('30.123.456');
  });

  it('forgets the saved data once the order is paid', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name: 'Ana Gómez', email: 'ana@example.com', phone: '1123456789', document: '30123456' }));
    renderStore(fakeStorefront({ resumeCheckout: async () => checkout('paid', { delivery: carrierDelivery() }) }), '/pedido');

    await screen.findByRole('heading', { name: '¡Gracias por tu compra!' });
    await waitFor(() => expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull());
  });
});

describe('discount codes', () => {
  const lines = [{ code: 'CP-ORK', quantity: 3, price: 95000, max: 5 }];

  function summaryRow(label: string | RegExp) {
    return within(screen.getByRole('complementary')).getByText(label).nextElementSibling?.textContent;
  }

  it('applies a code in the cart, takes it off the products and removes it', async () => {
    let current = saved;
    const storefront = fakeStorefront({
      getCart: async () => current,
      applyDiscountCode: async () => (current = withCode(saved, { amount: 28500 })),
      removeDiscountCode: async () => (current = saved),
    });
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '¿Tenés un código de descuento?' }));
    await user.type(screen.getByLabelText('Código de descuento'), ' bienvenida10 {Enter}');

    await waitFor(() => expect(storefront.applyDiscountCode).toHaveBeenCalledWith('bienvenida10'));
    expect(await within(screen.getByRole('complementary')).findByText('Código BIENVENIDA10')).toBeInTheDocument();
    expect(summaryRow('Código BIENVENIDA10')).toMatch(/−.*28\.500/);
    // 285.000 − 28.500.
    expect(summaryTotal()).toMatch(/256\.500/);
    // Enter aplica el código: no sigue al paso Envío.
    expect(screen.getByRole('heading', { name: 'Tu carrito' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar el código BIENVENIDA10' }));
    await waitFor(() => expect(storefront.removeDiscountCode).toHaveBeenCalled());
    await waitFor(() => expect(within(screen.getByRole('complementary')).queryByText('Código BIENVENIDA10')).not.toBeInTheDocument());
    expect(summaryTotal()).toMatch(/285\.000/);
  });

  it('says why a code is refused and leaves the cart as it was', async () => {
    const storefront = fakeStorefront({ getCart: async () => saved, applyDiscountCode: async () => Promise.reject(codeRefusal('expired')) });
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '¿Tenés un código de descuento?' }));
    await user.type(screen.getByLabelText('Código de descuento'), 'VIEJO');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByText('Ese código venció.')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de descuento')).toHaveAttribute('aria-invalid', 'true');
    expect(summaryTotal()).toMatch(/285\.000/);
    // No es un error del carrito: el carrito sigue como estaba.
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
  });

  it('does not offer codes to a backend without them', async () => {
    const { discount_code: _code, discount_code_error: _error, total_with_discount_code: _total, ...legacy } = saved;
    renderStore(fakeStorefront({ getCart: async () => legacy as typeof saved }), '/checkout');

    expect(await screen.findByRole('heading', { name: 'Tu carrito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '¿Tenés un código de descuento?' })).not.toBeInTheDocument();
  });

  it('keeps Openpay out while the cart has a code and prices the code with the chosen method', async () => {
    const coded = withCode(cart(lines, 'cart-1', { openpay: null, transfer: null, cash: null }), { amount: 28500, methods: { openpay: 'not_allowed' } });
    const storefront = fakeStorefront({ getCart: async () => coded, getPaymentMethods: async () => paymentMethods(), shopper: signedIn() });
    localStorage.setItem(cartStorageKey(VENUE), 'tok');
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await continueToPayment(user);

    const payment = screen.getByRole('region', { name: 'Pago' });
    const openpay = await within(payment).findByRole('radio', { name: /Openpay/ });
    expect(openpay).toBeDisabled();
    expect(openpay).toHaveAccessibleName(/No acepta códigos de descuento/);
    // Se elige el primero que acepta el código.
    expect(within(payment).getByRole('radio', { name: /Transferencia bancaria/ })).toBeChecked();
    expect(summaryRow('Código BIENVENIDA10')).toMatch(/−.*28\.500/);
    expect(summaryTotal()).toMatch(/256\.500/);

    await user.click(screen.getByRole('button', { name: /Confirmar pedido .*256\.500/ }));
    await waitFor(() => expect(storefront.checkout).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'transfer' })));
  });

  it('asks to remove the code when no method takes it', async () => {
    const coded = withCode(cart(lines, 'cart-1', { openpay: null }), { amount: 28500, methods: { openpay: 'not_allowed' } });
    renderStore(fakeStorefront({ getCart: async () => coded }), '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await fillBuyer(user);
    await continueToPayment(user);

    expect(await screen.findByText('Ninguno de los medios de pago de ahora acepta el código BIENVENIDA10. Quitalo para poder pagar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagar/ })).toBeDisabled();
  });

  it('says when the method discount outweighs the code', async () => {
    const coded = withCode(cart(lines, 'cart-1', { openpay: null, transfer: 15, cash: null }), { amount: 28500, methods: { openpay: 'not_allowed', transfer: 'outweighed' } });
    const methods = paymentMethods().map((method) => (method.method === 'transfer' ? { ...method, discount_percent: '15.00' } : method));
    renderStore(fakeStorefront({ getCart: async () => coded, getPaymentMethods: async () => methods, shopper: signedIn() }), '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await continueToPayment(user);

    const summary = screen.getByRole('complementary');
    expect(await within(summary).findByText(/no se suma al descuento por pagar con transferencia/)).toBeInTheDocument();
    expect(within(summary).queryByText('Código BIENVENIDA10')).not.toBeInTheDocument();
    expect(summaryRow('Descuento 15% · transferencia')).toMatch(/−.*42\.750/);
    expect(summaryTotal()).toMatch(/242\.250/);
  });

  it('does not pay while the code no longer applies', async () => {
    const expired = withCode(cart(lines, 'cart-1', { openpay: null, transfer: null }), { amount: 28500, error: 'expired', methods: { openpay: 'not_allowed' } });
    renderStore(fakeStorefront({ getCart: async () => expired, getPaymentMethods: async () => paymentMethods(), shopper: signedIn() }), '/checkout');
    const user = userEvent.setup();

    expect(await screen.findByText('Ese código venció. Quitalo para poder pagar.')).toBeInTheDocument();
    // El código no descuenta nada mientras no vale.
    expect(summaryTotal()).toMatch(/285\.000/);
    await continueToShipping(user);
    await continueToPayment(user);

    expect(screen.getByText('Quitá el código de descuento para poder pagar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar pedido/ })).toBeDisabled();
  });

  it('reloads the cart and explains it when the checkout refuses the code', async () => {
    const coded = withCode(cart(lines, 'cart-1', { openpay: null, transfer: null }), { amount: 28500, methods: { openpay: 'not_allowed' } });
    const storefront = fakeStorefront({
      getCart: async () => coded,
      getPaymentMethods: async () => paymentMethods(),
      checkout: async () => Promise.reject(codeRefusal('exhausted', 'discount_code')),
      shopper: signedIn(),
    });
    renderStore(storefront, '/checkout');
    const user = userEvent.setup();

    await continueToShipping(user);
    await continueToPayment(user);
    const loads = storefront.getCart.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Confirmar pedido/ }));

    expect(await screen.findByText('El código de descuento no se puede usar')).toBeInTheDocument();
    expect(screen.getByText(/Ese código ya no tiene usos disponibles\./)).toBeInTheDocument();
    expect(storefront.getCart.mock.calls.length).toBeGreaterThan(loads);
    // No es que el local dejó de aceptar el medio.
    expect(screen.queryByText(/dejó de aceptar/)).not.toBeInTheDocument();
  });
});
