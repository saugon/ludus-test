import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeStorefront, product } from '../test/fakes';
import { renderStore } from '../test/render';

const catalog = [
  product({ code: 'ALI', name: 'Alicates de corte', category: 'Herramientas', price: '15650.00' }),
  product({ code: 'ORK', name: 'Combat Patrol: Orks', category: 'Miniaturas', price: '95000.00' }),
  product({ code: 'NGH', name: 'Battletome: Nighthaunt', category: 'Libros y codex', status: 'out_of_stock', max_quantity: 0 }),
];

function home() {
  return renderStore(fakeStorefront({ products: catalog }), '/');
}

describe('the home', () => {
  it('shows the available products in Destacados, each with its price and Agregar', async () => {
    home();

    const featured = within(await screen.findByRole('region', { name: 'Productos destacados' }));
    const cards = featured.getAllByRole('article');
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(['Alicates de corte', 'Combat Patrol: Orks']);
    const alicates = cards[0];
    expect(alicates).toHaveTextContent('Herramientas');
    expect(within(alicates).getByText('$ 15.650')).toBeInTheDocument();
    expect(within(alicates).getByRole('button', { name: /^Agregar .+ al carrito$/ })).toBeInTheDocument();
    expect(within(alicates).getByRole('link', { name: 'Alicates de corte' })).toHaveAttribute('href', '/productos/ALI');
    // El link se estira a toda la tarjeta: ningún contenedor entre la tarjeta y el link puede ser `relative`.
    for (let node = within(alicates).getByRole('link', { name: 'Alicates de corte' }).parentElement; node && node !== alicates; node = node.parentElement) {
      expect(node.className).not.toMatch(/\brelative\b/);
    }
  });

  it('shows the encargos with the reference price and Consultar by WhatsApp', async () => {
    home();

    const encargos = within(screen.getByRole('region', { name: /^Por encargo/ }));
    const consult = await encargos.findByRole('link', { name: 'Consultar por Battletome: Nighthaunt en WhatsApp' });
    expect(consult).toHaveTextContent('Consultar');
    expect(consult.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/.+Battletome/);
    const card = consult.closest('article')!;
    expect(card).toHaveTextContent('Precio de referencia');
    expect(within(card).queryByRole('button', { name: /^Agregar .+ al carrito$/ })).not.toBeInTheDocument();
    expect(encargos.getByRole('link', { name: /Pedir algo que no está en la lista/ })).toBeInTheDocument();
  });

  it('links each category of the catalog to the filtered list', async () => {
    home();

    const row = within(await screen.findByRole('region', { name: 'Categorías' }));
    expect(row.getAllByRole('link').map((link) => [link.textContent?.replace(/Ver productos.*/, ''), link.getAttribute('href')])).toEqual([
      ['Miniaturas', '/productos?categoria=Miniaturas'],
      ['Herramientas', '/productos?categoria=Herramientas'],
      ['Libros y codex', '/productos?categoria=Libros%20y%20codex'],
    ]);
    // Cada categoría conocida lleva su foto; una sin foto queda con el rayado.
    const photo = (name: string) => row.getByRole('link', { name: new RegExp(`^${name}`) }).querySelector('img')?.getAttribute('src');
    expect(photo('Miniaturas')).toBe('/img/categorias/miniaturas-400.webp');
    expect(photo('Libros y codex')).toBe('/img/categorias/libros-400.webp');
  });

  it("lists the store's main categories from the API, not from the loaded products", async () => {
    const listCategories = async () => [
      { name: 'Pinturas', product_count: 4, subcategories: [] },
      { name: 'Miniaturas', product_count: 9, subcategories: [{ name: 'Orks', product_count: 3 }] },
    ];
    renderStore(fakeStorefront({ products: catalog, listCategories }), '/');

    const row = within(await screen.findByRole('region', { name: 'Categorías' }));
    expect(await row.findByRole('link', { name: /^Pinturas/ })).toHaveAttribute('href', '/productos?categoria=Pinturas');
    // En el orden de la tienda, y sin las subcategorías.
    expect(row.getAllByRole('link').map((link) => link.textContent?.replace(/Ver productos.*/, ''))).toEqual(['Miniaturas', 'Pinturas']);
  });

  it('shows the subcategory on a card, or the main category when it has none', async () => {
    renderStore(fakeStorefront({ products: [product({ code: 'ORK', name: 'Boyz', category: 'Miniaturas', subcategory: 'Orks' }), ...catalog.slice(0, 1)] }), '/');

    const featured = within(await screen.findByRole('region', { name: 'Productos destacados' }));
    const card = (name: string) => featured.getByRole('link', { name }).closest('article')!;
    expect(await featured.findByRole('link', { name: 'Boyz' })).toBeInTheDocument();
    expect(card('Boyz')).toHaveTextContent('Orks');
    expect(card('Boyz')).not.toHaveTextContent('Miniaturas');
    expect(card('Alicates de corte')).toHaveTextContent('Herramientas');
  });

  it('has the play, about and contact sections the navbar links to', async () => {
    home();

    expect(await screen.findByRole('heading', { name: 'Reservá tu mesa.' })).toBeInTheDocument();
    expect(screen.getByText('mesas para jugar')).toBeInTheDocument();
    expect(document.getElementById('jugar')).toContainElement(screen.getByRole('heading', { name: /Vení a jugar/ }));
    expect(document.getElementById('nosotros')).toContainElement(screen.getByRole('heading', { name: 'Somos jugadores antes que vendedores.' }));

    const contact = within(document.getElementById('contacto')!);
    expect(contact.getByTitle('Mapa: Olleros 3162, CABA')).toBeInTheDocument();
    expect(contact.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\//));
    expect(contact.getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/ludusgamestore/');
    expect(contact.getByText('Martes a viernes')).toBeInTheDocument();
  });

  it('rotates the hero between wargames, card games and role-playing when its progress bar fills, with controls to move and pause', () => {
    home();
    const hero = within(screen.getByRole('region', { name: 'Lo que vas a encontrar en Ludus' }));
    // Solo la diapositiva activa es visible para lectores de pantalla y para el teclado.
    const visibleTitle = () =>
      hero
        .getAllByRole('heading', { level: 2 })
        .filter((heading) => !heading.closest('[inert]'))
        .map((heading) => heading.textContent);
    expect(visibleTitle()).toEqual(['Armá tu ejército.']);

    // La barra de progreso de la diapositiva activa marca el ritmo: al llenarse, pasa a la siguiente.
    fireEvent.animationEnd(hero.getByTestId('hero-progress'));
    expect(visibleTitle()).toEqual(['Barajá y repartí.']);

    fireEvent.click(hero.getByRole('button', { name: 'Diapositiva siguiente' }));
    expect(visibleTitle()).toEqual(['Tirá iniciativa.']);
    expect(hero.getByRole('link', { name: /Reservá tu mesa/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/.+mesa/));

    fireEvent.click(hero.getByRole('button', { name: 'Diapositiva siguiente' }));
    expect(visibleTitle()).toEqual(['Armá tu ejército.']);
    fireEvent.click(hero.getByRole('button', { name: 'Ir a Rol' }));
    expect(hero.getByRole('button', { name: 'Ir a Rol' })).toHaveAttribute('aria-current', 'true');

    // El mouse sobre el hero y el foco no la frenan. (El freno con el cursor sobre un botón es solo CSS, sin probar acá.)
    const region = screen.getByRole('region', { name: 'Lo que vas a encontrar en Ludus' });
    fireEvent.pointerEnter(region, { pointerType: 'mouse' });
    hero.getByRole('button', { name: 'Ir a Rol' }).focus();
    expect(hero.getByTestId('hero-progress').className).not.toMatch(/paused/);
    fireEvent.click(hero.getByRole('button', { name: 'Pausar el carrusel' }));
    expect(hero.getByTestId('hero-progress').className).toMatch(/animation-play-state:paused/);
    fireEvent.click(hero.getByRole('button', { name: 'Reanudar el carrusel' }));
    expect(hero.getByTestId('hero-progress').className).not.toMatch(/paused/);
  });

  it('puts the navbar over the hero until the page scrolls, and only on the home', async () => {
    const { unmount } = home();

    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-over-hero');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });
    fireEvent.scroll(window);
    expect(header).not.toHaveAttribute('data-over-hero');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    fireEvent.scroll(window);
    expect(header).toHaveAttribute('data-over-hero');
    unmount();

    renderStore(fakeStorefront({ products: catalog }), '/productos');
    expect(screen.getByRole('banner')).not.toHaveAttribute('data-over-hero');
  });
});
