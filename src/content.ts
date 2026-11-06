export const store = {
  name: 'Ludus Game Store',
  address: 'Olleros 3162, CABA',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Olleros+3162%2C+CABA%2C+Argentina',
  mapEmbedUrl: 'https://www.google.com/maps?q=Olleros+3162,+CABA,+Argentina&z=16&hl=es&output=embed',
  instagram: { handle: '@ludusgamestore', url: 'https://www.instagram.com/ludusgamestore/' },
  whatsappNumber: '5491100000000',
  hours: [
    { days: 'Martes a viernes', time: '14 a 22 h' },
    { days: 'Sábados y domingos', time: '13 a 21 h' },
    { days: 'Lunes', time: 'Cerrado' },
  ],
  tables: 17,
  tournaments:
    'Organizamos torneos y ligas de Warhammer 40.000, Age of Sigmar y Kill Team. Las fechas las publicamos en Instagram.',
  // Orden de las categorías en el catálogo y en la home. Las que no están en la lista van al final, en orden alfabético.
  // Se comparan sin importar mayúsculas ni tildes ("Libros y códex" coincide con "Libros y codex").
  categoryOrder: ['Miniaturas', 'Pinturas', 'Herramientas', 'Accesorios', 'Libros y codex'],
  // Foto de cada categoría en public/img/categorias/<nombre>-400.webp y -800.webp (4:5). Misma comparación que el orden.
  categoryImages: {
    Miniaturas: 'miniaturas',
    Pinturas: 'pinturas',
    Herramientas: 'herramientas',
    Accesorios: 'accesorios',
    'Libros y codex': 'libros',
  } as Record<string, string>,
  // Las fotos con licencia CC BY piden nombrar al autor (ver public/img/categorias/CREDITOS.md).
  categoryPhotoCredits: [
    { author: 'Jo Naylor', url: 'https://www.flickr.com/photos/11598937@N08/9355579552' },
    { author: 'malias', url: 'https://www.flickr.com/photos/62752875@N00/154162207' },
    { author: 'guldfisken', url: 'https://www.flickr.com/photos/92269864@N00/398144161' },
  ],
  featuredCodes: [] as string[],
  featuredCount: 12,
};

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${store.whatsappNumber}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const messages = {
  general: 'Hola Ludus, tengo una consulta.',
  order: 'Hola Ludus, quiero hacer un encargo: ',
  table: 'Hola Ludus, quiero reservar una mesa para jugar. Día y horario: ',
  product: (name: string) => `Hola Ludus, quiero encargar "${name}". ¿Me pasan precio y demora?`,
  saleIssue: (sale: number | null) =>
    sale ? `Hola Ludus, tengo una consulta por el pedido #${sale}.` : 'Hola Ludus, tengo una consulta por un pago.',
};
