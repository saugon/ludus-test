import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cart, fakeStorefront, product, signedIn } from '../test/fakes';
import { renderStore } from '../test/render';

const LONG_NAME = 'Warhammer 40.000: Leviathan Edición de Coleccionista con Miniaturas Exclusivas y Libro de Reglas de Tapa Dura';

const catalog = [
  product({ code: 'ALI', name: 'Alicates de corte', category: 'Herramientas', price: '15650.00' }),
  product({ code: 'LEV', name: LONG_NAME, category: 'Miniaturas', price: '1250000.00' }),
  product({ code: 'NGH', name: 'Battletome: Nighthaunt', category: 'Libros y codex', status: 'out_of_stock', max_quantity: 0 }),
];

function categories() {
  return within(screen.getByRole('group', { name: 'Categorías' }));
}

describe('the catalog', () => {
  it('marks a product already in the cart up to its stock with a short tag, not a sentence', async () => {
    localStorage.setItem('vertex-storefront:ludus-test:cart', 'cart-1');
    renderStore(
      fakeStorefront({
        products: [product({ code: 'ASP', name: 'Army Painter Speedpaint Set', category: 'Pinturas', max_quantity: 1 }), product({ code: 'ALI', name: 'Alicates de corte' })],
        getCart: async () => cart([{ code: 'ASP', quantity: 1, max: 1 }]),
      }),
      '/productos',
    );

    const card = (name: string) => within(screen.getByRole('link', { name }).closest('article')!);
    await screen.findByRole('link', { name: 'Army Painter Speedpaint Set' });
    const full = card('Army Painter Speedpaint Set');
    expect(await full.findByText('Ya tenés 1 en el carrito, el máximo disponible.')).toHaveClass('sr-only');
    expect(full.getByText('En el carrito')).toBeInTheDocument();
    expect(full.queryByRole('button', { name: /^Agregar .+ al carrito$/ })).not.toBeInTheDocument();
    expect(card('Alicates de corte').getByRole('button', { name: /^Agregar .+ al carrito$/ })).toBeInTheDocument();
  });

  it('shows the store header and a vertical category column with "Todos" active', async () => {
    renderStore(fakeStorefront({ products: catalog }), '/productos');

    expect(await screen.findByText('3 productos encontrados')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo de productos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Categorías' })).toBeInTheDocument();
    expect(categories().getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    // Cada categoría lleva al lado cuántos productos tiene.
    expect(categories().getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Todos', 'Miniaturas1', 'Herramientas1', 'Libros y codex1']);
  });

  it('filters by category with ?categoria=, updates the count and goes back with "Todos"', async () => {
    const user = userEvent.setup();
    renderStore(fakeStorefront({ products: catalog }), '/productos');

    await user.click(await categories().findByRole('button', { name: 'Herramientas' }));
    expect(categories().getByRole('button', { name: 'Herramientas' })).toHaveAttribute('aria-pressed', 'true');
    expect(categories().getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 producto encontrado en Herramientas')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);

    await user.click(categories().getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('3 productos encontrados')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('filters by availability with ?estado= in the same column', async () => {
    const user = userEvent.setup();
    renderStore(fakeStorefront({ products: catalog }), '/productos');
    const availability = () => within(screen.getByRole('group', { name: 'Disponibilidad' }));

    await user.click(await availability().findByRole('button', { name: 'Con stock' }));
    expect(availability().getByRole('button', { name: 'Con stock' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 productos encontrados')).toBeInTheDocument();
    expect(screen.queryByText('Battletome: Nighthaunt')).not.toBeInTheDocument();

    await user.click(availability().getByRole('button', { name: 'Por encargo' }));
    expect(screen.getByText('1 producto encontrado')).toBeInTheDocument();
    expect(screen.getByText('Battletome: Nighthaunt')).toBeInTheDocument();

    await user.click(categories().getByRole('button', { name: 'Herramientas' }));
    expect(screen.getByText('0 productos encontrados en Herramientas')).toBeInTheDocument();

    await user.click(availability().getByRole('button', { name: 'Todos' }));
    expect(availability().getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 producto encontrado en Herramientas')).toBeInTheDocument();
  });

  it('has its own search box for mobile that keeps the category', async () => {
    const user = userEvent.setup();
    renderStore(fakeStorefront({ products: catalog }), '/productos?categoria=Miniaturas');

    const main = within(screen.getByRole('main'));
    await user.type(main.getByRole('searchbox', { name: 'Buscar productos' }), 'leviathan{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Resultados para «leviathan»' })).toBeInTheDocument();
    expect(screen.getByText('1 producto encontrado en Miniaturas')).toBeInTheDocument();
  });

  it('combines the category from the URL with the search in the count', async () => {
    renderStore(fakeStorefront({ products: catalog }), '/productos?categoria=Herramientas&q=codex');

    expect(await screen.findByText('0 productos encontrados en Herramientas')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Resultados para «codex»' })).toBeInTheDocument();
  });

  it('opens the subcategories of the chosen category and filters by one with ?subcategoria=', async () => {
    const user = userEvent.setup();
    const withSubcategories = [
      ...catalog,
      product({ code: 'BOY', name: 'Boyz', category: 'Miniaturas', subcategory: 'Orks' }),
      product({ code: 'WAR', name: 'Necron Warriors', category: 'Miniaturas', subcategory: 'Necrons' }),
    ];
    renderStore(fakeStorefront({ products: withSubcategories }), '/productos');

    expect(await screen.findByText('5 productos encontrados')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Subcategorías de Miniaturas' })).not.toBeInTheDocument();

    await user.click(categories().getByRole('button', { name: 'Miniaturas' }));
    expect(categories().getByRole('button', { name: 'Miniaturas' })).toHaveAttribute('aria-expanded', 'true');
    const subcategories = within(screen.getByRole('list', { name: 'Subcategorías de Miniaturas' }));
    expect(subcategories.getAllByRole('button').map((button) => button.textContent)).toEqual(['Necrons1', 'Orks1']);
    expect(screen.getByText('3 productos encontrados en Miniaturas')).toBeInTheDocument();

    await user.click(subcategories.getByRole('button', { name: 'Orks' }));
    expect(subcategories.getByRole('button', { name: 'Orks' })).toHaveAttribute('aria-pressed', 'true');
    expect(categories().getByRole('button', { name: 'Miniaturas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 producto encontrado en Miniaturas › Orks')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);

    // Volver a la categoría principal saca la subcategoría.
    await user.click(categories().getByRole('button', { name: 'Miniaturas' }));
    expect(screen.getByText('3 productos encontrados en Miniaturas')).toBeInTheDocument();
  });

  it('opens the category and subcategory that come in the address', async () => {
    const withSubcategories = [...catalog, product({ code: 'BOY', name: 'Boyz', category: 'Miniaturas', subcategory: 'Orks' })];
    renderStore(fakeStorefront({ products: withSubcategories }), '/productos?categoria=Miniaturas&subcategoria=Orks');

    expect(await screen.findByText('1 producto encontrado en Miniaturas › Orks')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Subcategorías de Miniaturas' })).getByRole('button', { name: 'Orks' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads every page of the catalog', async () => {
    const storefront = fakeStorefront();
    storefront.listProductsPage
      .mockResolvedValueOnce({ products: catalog.slice(0, 2), nextCursor: 'next' })
      .mockResolvedValueOnce({ products: catalog.slice(2), nextCursor: null });
    renderStore(storefront, '/productos');

    expect(await screen.findByText('3 productos encontrados')).toBeInTheDocument();
    expect(storefront.listProductsPage).toHaveBeenNthCalledWith(1, { limit: 100, cursor: null });
    expect(storefront.listProductsPage).toHaveBeenNthCalledWith(2, { limit: 100, cursor: 'next' });
  });

  it('keeps a category without products visible and active, with 0 results', async () => {
    renderStore(fakeStorefront({ products: catalog }), '/productos?categoria=Escenografía');

    expect(await screen.findByText('0 productos encontrados en Escenografía')).toBeInTheDocument();
    expect(categories().getByRole('button', { name: 'Escenografía' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('No hay productos con estos filtros.')).toBeInTheDocument();
  });

  it('renders the cards like the home ones: long name as is, 7-digit price and the right action', async () => {
    renderStore(fakeStorefront({ products: catalog }), '/productos');

    const cards = await screen.findAllByRole('article');
    const leviathan = cards.find((card) => card.textContent?.includes(LONG_NAME))!;

    // El nombre se muestra tal cual viene del catálogo, sin pasarlo a mayúsculas.
    const link = within(leviathan).getByRole('link', { name: LONG_NAME });
    expect(link.closest('h3')).not.toHaveClass('uppercase');
    expect(within(leviathan).getByText('$ 1.250.000')).toHaveClass('whitespace-nowrap');
    // El nombre largo se corta en tres líneas con CSS, sin tocar el texto.
    expect(link.closest('h3')).toHaveClass('line-clamp-3');
    expect(within(leviathan).getByRole('button', { name: /^Agregar .+ al carrito$/ })).toBeInTheDocument();

    const nighthaunt = cards.find((card) => card.textContent?.includes('Battletome: Nighthaunt'))!;
    expect(within(nighthaunt).getByText('Por encargo')).toBeInTheDocument();
    const consult = within(nighthaunt).getByRole('link', { name: 'Consultar por Battletome: Nighthaunt en WhatsApp' });
    expect(consult).toHaveAttribute('href', expect.stringContaining('wa.me/'));
    expect(decodeURIComponent(consult.getAttribute('href')!)).toContain('"Battletome: Nighthaunt"');
    expect(within(nighthaunt).queryByRole('button', { name: /^Agregar .+ al carrito$/ })).not.toBeInTheDocument();
  });

  it('adds to the cart from a card and the navbar cart shows the count', async () => {
    const user = userEvent.setup();
    const storefront = fakeStorefront({ products: catalog });
    renderStore(storefront, '/productos');

    expect(await screen.findByRole('button', { name: 'Abrir carrito, vacío' })).toBeInTheDocument();
    const alicates = (await screen.findAllByRole('article')).find((card) => card.textContent?.includes('Alicates de corte'))!;
    await user.click(within(alicates).getByRole('button', { name: /^Agregar .+ al carrito$/ }));

    expect(storefront.setCartLines).toHaveBeenCalledWith([{ code: 'ALI', quantity: 1 }]);
    const cartButton = await screen.findByRole('button', { name: 'Abrir carrito, 1 producto' });
    expect(within(cartButton).getByText('1')).toBeInTheDocument();
    expect(within(cartButton).getByText('Carrito')).toBeInTheDocument();

    await user.click(cartButton);
    expect(await screen.findByRole('dialog', { name: /Tu carrito/ })).toBeInTheDocument();
  });
});

describe('the navbar', () => {
  it('shows the orange "Ingresar" pill without a session and the avatar with one', async () => {
    const { unmount } = renderStore(fakeStorefront(), '/');
    const login = await screen.findByRole('link', { name: 'Ingresar' });
    expect(login).toHaveTextContent('Ingresar');
    expect(login).toHaveClass('bg-ember', 'rounded-full');
    // El texto se ve en todos los anchos: no queda escondido detrás de un breakpoint.
    expect(within(login).getByText('Ingresar', { ignore: 'svg' }).className).not.toMatch(/hidden/);
    unmount();

    renderStore(fakeStorefront({ shopper: signedIn() }), '/');
    const avatar = await screen.findByRole('link', { name: 'Mis pedidos, sesión de Ana' });
    expect(avatar).toHaveTextContent('A');
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  it('shows the logo with its subtitle, without an announcement bar above the navbar', async () => {
    renderStore(fakeStorefront(), '/');

    const home = await screen.findByRole('link', { name: 'Ludus Game Store, inicio' });
    expect(screen.queryByRole('list', { name: 'Novedades' })).not.toBeInTheDocument();
    expect(home).toHaveTextContent('Ludus Game StoreWargames · Argentina');
  });

  it('opens the search below the navbar from the magnifier and closes it after searching', async () => {
    const user = userEvent.setup();
    renderStore(fakeStorefront({ products: catalog }), '/');
    const header = within(screen.getByRole('banner'));

    expect(header.queryByRole('searchbox')).not.toBeInTheDocument();
    await user.click(header.getByRole('button', { name: 'Buscar productos' }));
    const box = header.getByRole('searchbox', { name: 'Buscar productos' });
    expect(box).toHaveFocus();
    expect(header.getByRole('button', { name: 'Cerrar búsqueda' })).toHaveAttribute('aria-expanded', 'true');

    await user.type(box, 'alicates{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Resultados para «alicates»' })).toBeInTheDocument();
    expect(header.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('lists the current links and opens the cart from the mobile menu', async () => {
    const user = userEvent.setup();
    renderStore(fakeStorefront(), '/');

    await user.click(await screen.findByRole('button', { name: 'Abrir menú' }));
    const menu = screen.getByRole('dialog', { name: 'Menú' });
    expect(within(menu).getAllByRole('link').slice(0, 5).map((link) => link.textContent)).toEqual(['Productos', 'Encargos', 'Vení a jugar', 'Nosotros', 'Contacto']);

    expect(within(menu).getByRole('searchbox', { name: 'Buscar productos' })).toBeInTheDocument();

    await user.click(within(menu).getByRole('button', { name: 'Carrito' }));
    expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /Tu carrito/ })).toBeInTheDocument();
  });
});
