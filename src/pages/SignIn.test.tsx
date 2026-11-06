import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cart, fakeStorefront, sdkError, signedIn } from '../test/fakes';
import { renderStore } from '../test/render';

async function askForCode(email = 'ana@example.com') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Recibir código' }));
  await screen.findByRole('heading', { name: 'Revisá tu email' });
  return user;
}

describe('the /ingresar page', () => {
  it('signs in with the emailed code and lands on the orders', async () => {
    const storefront = fakeStorefront();
    renderStore(storefront, '/ingresar');

    const user = await askForCode();
    expect(storefront.shopper.requestCode).toHaveBeenCalledWith('ana@example.com');
    expect(screen.getByText(/Vence en 10 minutos/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Código'), '123456');

    expect(await screen.findByRole('tab', { name: 'Mis pedidos', selected: true })).toBeInTheDocument();
    expect(storefront.shopper.signIn).toHaveBeenCalledTimes(1);
    expect(storefront.shopper.signIn).toHaveBeenCalledWith({ email: 'ana@example.com', code: '123456' });
  });

  it('asks a new shopper for their name and goes back to the checkout', async () => {
    const storefront = fakeStorefront({
      getCart: async () => cart([{ code: 'CP-ORK', quantity: 1 }]),
      shopper: { signIn: async () => ({ status: 'needs_name' }) },
    });
    renderStore(storefront, '/ingresar?volver=%2Fcheckout%2Fenvio');

    const user = await askForCode('nico@example.com');
    await user.type(screen.getByLabelText('Código'), '654321');

    await screen.findByRole('heading', { name: 'Es tu primera vez' });
    await user.type(screen.getByLabelText('Nombre y apellido'), 'Nico Paz');
    await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Datos y envío' })).toBeInTheDocument();
    expect(storefront.shopper.completeSignUp).toHaveBeenCalledWith('Nico Paz');
    expect(screen.getByRole('region', { name: 'Comprás como Nico Paz' })).toBeInTheDocument();
  });

  it('does not ask for a code with an invalid email', async () => {
    const storefront = fakeStorefront();
    renderStore(storefront, '/ingresar');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), 'ana@');
    await user.click(screen.getByRole('button', { name: 'Recibir código' }));

    expect(screen.getByText('Escribí un email válido, por ejemplo nombre@gmail.com.')).toBeInTheDocument();
    expect(storefront.shopper.requestCode).not.toHaveBeenCalled();
  });

  it('clears a wrong code and lets the shopper try again', async () => {
    const storefront = fakeStorefront({
      shopper: {
        signIn: async () => {
          throw sdkError('invalid_code', 422);
        },
      },
    });
    renderStore(storefront, '/ingresar');

    const user = await askForCode();
    await user.type(screen.getByLabelText('Código'), '000000');

    expect(await screen.findByText('El código está mal o ya venció. Revisalo o pedí uno nuevo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Código')).toHaveValue('');
    expect(screen.getByLabelText('Código')).toBeEnabled();
  });

  it('locks the code after too many tries and only offers a new one once the wait is over', async () => {
    const storefront = fakeStorefront({
      shopper: {
        signIn: async () => {
          throw sdkError('too_many_attempts', 429);
        },
      },
    });
    renderStore(storefront, '/ingresar');

    const user = await askForCode();
    await user.type(screen.getByLabelText('Código'), '111111');

    expect(await screen.findByText('Demasiados intentos')).toBeInTheDocument();
    expect(screen.getByLabelText('Código')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Ingresar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pedir otro código en \d+ s/ })).toBeDisabled();
  });

  it('reuses the code just sent when the shopper comes back to the same email', async () => {
    const storefront = fakeStorefront();
    renderStore(storefront, '/ingresar');

    const user = await askForCode();
    await user.click(screen.getByRole('button', { name: 'Usar otro email' }));
    await user.click(screen.getByRole('button', { name: 'Recibir código' }));

    expect(await screen.findByText('Ya te mandamos un código a este email hace un momento. Usá ese.')).toBeInTheDocument();
    expect(storefront.shopper.requestCode).toHaveBeenCalledTimes(1);
  });

  it('says when the code could not be emailed', async () => {
    renderStore(
      fakeStorefront({
        shopper: {
          requestCode: async () => {
            throw sdkError('service_unavailable', 503);
          },
        },
      }),
      '/ingresar',
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Recibir código' }));

    expect(await screen.findByText('No pudimos mandarte el código. Probá de nuevo en unos minutos.')).toBeInTheDocument();
  });

  it('sends a shopper who already has a session straight to where they were going', async () => {
    renderStore(fakeStorefront({ shopper: signedIn() }), '/ingresar');

    expect(await screen.findByRole('tab', { name: 'Mis pedidos', selected: true })).toBeInTheDocument();
  });

  it('ignores a return address outside the store', async () => {
    const storefront = fakeStorefront();
    renderStore(storefront, '/ingresar?volver=https%3A%2F%2Fevil.example.com');

    const user = await askForCode();
    await user.type(screen.getByLabelText('Código'), '123456');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Mis pedidos', selected: true })).toBeInTheDocument());
  });
});
