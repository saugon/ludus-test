import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { andreaniOption, cart, carrierDelivery, checkout, deliveryOptions, fakeStorefront, sdkError, signedIn } from '../test/fakes';
import { renderStore } from '../test/render';
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
