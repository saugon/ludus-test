import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeStorefront, product } from '../test/fakes';
import { renderStore } from '../test/render';

const nighthaunt = product({ code: 'BT-NH', name: 'Nighthaunt', image_url: 'https://cdn.example.com/nighthaunt.jpg' });

describe('the product photo', () => {
  it('opens full screen in a modal and closes with the button, Escape or a click', async () => {
    const user = userEvent.setup();
    renderStore(fakeStorefront({ getProduct: async () => nighthaunt }), '/productos/BT-NH');

    const open = await screen.findByRole('button', { name: 'Ver la foto de Nighthaunt en pantalla completa' });
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Nighthaunt' });
    expect(within(dialog).getByRole('img', { name: 'Nighthaunt' })).toHaveAttribute('src', nighthaunt.image_url);
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    await user.click(open);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(open);
    await user.click(within(screen.getByRole('dialog')).getByRole('img'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is not clickable without a photo', async () => {
    renderStore(fakeStorefront({ getProduct: async () => product({ code: 'BT-NH', name: 'Nighthaunt' }) }), '/productos/BT-NH');

    expect(await screen.findByRole('img', { name: 'Nighthaunt, sin foto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pantalla completa/ })).not.toBeInTheDocument();
  });
});
