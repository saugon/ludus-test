import { Link, useSearchParams } from 'react-router-dom';
import { ErrorNotice } from '../components/ErrorNotice';
import { CloseIcon, WhatsAppIcon } from '../components/Icons';
import { ShowcaseEncargoCard, ShowcaseProductCard } from '../components/ShowcaseCard';
import { SearchForm } from '../components/SearchForm';
import { CardSkeleton, LoadingLabel } from '../components/Skeletons';
import { button, container, sectionTitle } from '../components/ui';
import { messages, whatsappUrl } from '../content';
import { categoryTree, filterProducts, type CategoryNode, type StockFilter } from '../lib/search';
import { isOrderable, useProducts } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponible', label: 'Con stock' },
  { value: 'encargo', label: 'Por encargo' },
];

// Columna de filtros con el estilo de la tienda anterior: lista vertical, el activo en naranja sobre fondo naranja oscuro.
const filterItem =
  'flex w-full items-center gap-2 rounded-lg px-[0.8rem] py-[0.55rem] text-left font-ui text-[0.88rem] font-semibold leading-normal transition-colors';
const filterOn = 'bg-ember/10 text-ember';
const filterOff = 'text-mute hover:bg-white/4 hover:text-bone';
const countBadge = 'ml-auto shrink-0 pl-2 font-ui text-xs font-semibold tabular-nums text-dim';
const sidebarTitle = 'mb-4 font-display text-[1.2rem] leading-[1.2] tracking-[0.04em] text-white';

function GridIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}

// Una categoría o subcategoría que llega por URL y no tiene productos igual se muestra activa, para que se entienda el «0».
function withRequested(tree: CategoryNode[], category: string, subcategory: string, loaded: boolean): CategoryNode[] {
  if (!category || !loaded) return tree;
  const node = tree.find((entry) => entry.name === category);
  if (!node) return [...tree, { name: category, count: 0, subcategories: subcategory ? [{ name: subcategory, count: 0 }] : [] }];
  if (!subcategory || node.subcategories.some((sub) => sub.name === subcategory)) return tree;
  return tree.map((entry) => (entry === node ? { ...node, subcategories: [...node.subcategories, { name: subcategory, count: 0 }] } : entry));
}

export function Products() {
  const { status, products, error, reload, categories: listed } = useProducts();
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const category = params.get('categoria') ?? '';
  const stockParam = params.get('estado');
  const stock: StockFilter = stockParam === 'disponible' || stockParam === 'encargo' ? stockParam : 'todos';
  // La subcategoría sólo cuenta dentro de su categoría principal.
  const subcategory = category ? (params.get('subcategoria') ?? '') : '';
  const categories = withRequested(categoryTree(products, listed), category, subcategory, status !== 'loading');
  const results = filterProducts(products, { query, category, subcategory, stock });

  useTitle(query ? `Resultados para «${query}»` : 'Productos');

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  // Elegir una categoría principal (o «Todos») limpia la subcategoría; una subcategoría fija también su categoría.
  function chooseCategory(name: string, sub = '') {
    const next = new URLSearchParams(params);
    if (name) next.set('categoria', name);
    else next.delete('categoria');
    if (sub) next.set('subcategoria', sub);
    else next.delete('subcategoria');
    setParams(next, { replace: true });
  }

  return (
    <div className={`${container} pb-10 pt-8 sm:pb-14 sm:pt-12`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={`${sectionTitle} [overflow-wrap:anywhere]`}>
            {query ? `Resultados para «${query}»` : 'Catálogo de productos'}
          </h1>
        </div>
        {query && (
          <button type="button" onClick={() => update('q', '')} className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 font-ui text-sm font-bold uppercase tracking-[0.08em] text-mute hover:text-bone">
            <CloseIcon size={18} /> Borrar búsqueda
          </button>
        )}
      </div>

      {/* En mobile el buscador va acá, como en la tienda anterior (el navbar no tiene lugar para él). */}
      <SearchForm className="mt-6 sm:hidden" />

      <div className="mt-6 grid gap-4 sm:mt-8 lg:mt-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filtros" className="space-y-6 rounded-xl bg-ink-2 p-4 lg:self-start lg:rounded-none lg:bg-transparent lg:p-0">
          <div>
            <h2 className={sidebarTitle}>Categorías</h2>
            <div role="group" aria-label="Categorías">
              <ul className="flex flex-col gap-[0.2rem]">
                <li>
                  <button type="button" aria-pressed={!category} onClick={() => chooseCategory('')} className={`${filterItem} ${!category ? filterOn : filterOff}`}>
                    <GridIcon /> Todos
                  </button>
                </li>
                {categories.map((node) => {
                  const open = category === node.name;
                  return (
                    <li key={node.name}>
                      <button
                        type="button"
                        aria-pressed={open && !subcategory}
                        aria-expanded={node.subcategories.length > 0 ? open : undefined}
                        onClick={() => chooseCategory(open && !subcategory ? '' : node.name)}
                        className={`${filterItem} [overflow-wrap:anywhere] ${open && !subcategory ? filterOn : open ? 'text-bone hover:bg-white/4' : filterOff}`}
                      >
                        <span className="min-w-0">{node.name}</span>
                        <span aria-hidden="true" className={countBadge}>{node.count}</span>
                      </button>
                      {open && node.subcategories.length > 0 && (
                        <ul aria-label={`Subcategorías de ${node.name}`} className="mt-[0.2rem] ml-3 flex flex-col gap-[0.2rem] border-l border-line pl-2">
                          {node.subcategories.map((sub) => (
                            <li key={sub.name}>
                              <button
                                type="button"
                                aria-pressed={subcategory === sub.name}
                                onClick={() => chooseCategory(node.name, subcategory === sub.name ? '' : sub.name)}
                                className={`${filterItem} py-[0.45rem] text-[0.82rem] [overflow-wrap:anywhere] ${subcategory === sub.name ? filterOn : filterOff}`}
                              >
                                <span className="min-w-0">{sub.name}</span>
                                <span aria-hidden="true" className={countBadge}>{sub.count}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div>
            <h2 className={sidebarTitle}>Disponibilidad</h2>
            <div role="group" aria-label="Disponibilidad">
              <ul className="grid grid-cols-3 gap-[0.2rem] lg:flex lg:flex-col">
                {STOCK_OPTIONS.map((option) => {
                  const active = stock === option.value;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => update('estado', option.value === 'todos' ? '' : option.value)}
                        className={`${filterItem} max-lg:justify-center max-lg:px-2 max-lg:text-center ${active ? filterOn : filterOff}`}
                      >
                        {option.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {status !== 'loading' && (
            <p className="mb-4 font-ui text-[0.82rem] font-semibold tracking-[0.04em] text-dim" aria-live="polite">
              {results.length === 1 ? '1 producto encontrado' : `${results.length} productos encontrados`}
              {category && ` en ${category}${subcategory ? ` › ${subcategory}` : ''}`}
            </p>
          )}
          {status === 'error' && products.length === 0 ? (
          <ErrorNotice error={error} onRetry={reload} />
        ) : status === 'loading' && products.length === 0 ? (
          <div className="grid grid-cols-2 gap-[0.8rem] sm:grid-cols-3 sm:gap-[1.2rem] xl:grid-cols-4">
            <LoadingLabel>Cargando productos</LoadingLabel>
            {Array.from({ length: 8 }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center sm:p-12">
            <p className="text-xl font-semibold">
              {query ? `No encontramos productos para «${query}».` : 'No hay productos con estos filtros.'}
            </p>
            <p className="mt-2 text-mute">Probá con otra palabra o sacá los filtros. Si no lo tenemos, te lo conseguimos.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/productos" className={button.secondary}>
                Ver todos los productos
              </Link>
              <a
                href={whatsappUrl(query ? messages.order + query : messages.order)}
                target="_blank"
                rel="noopener noreferrer"
                className={button.order}
              >
                <WhatsAppIcon /> Encargarlo por WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-[0.8rem] sm:grid-cols-3 sm:gap-[1.2rem] xl:grid-cols-4">
            {results.map((product) => (
              <li key={product.code} className="flex">
                {isOrderable(product) ? (
                  <ShowcaseProductCard product={product} className="w-full" />
                ) : (
                  <ShowcaseEncargoCard product={product} tagged className="w-full" />
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}
