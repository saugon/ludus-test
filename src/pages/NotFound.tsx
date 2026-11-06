import { Link } from 'react-router-dom';
import { button, container } from '../components/ui';
import { useTitle } from '../lib/useTitle';

export function NotFound() {
  useTitle('Página no encontrada');

  return (
    <div className={`${container} py-24 text-center`}>
      <h1 className="text-7xl">Página no encontrada</h1>
      <p className="mt-4 text-lg text-mute">La dirección no existe o cambió.</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/" className={button.secondary}>
          Ir al inicio
        </Link>
        <Link to="/productos" className={button.primary}>
          Ver productos
        </Link>
      </div>
    </div>
  );
}
