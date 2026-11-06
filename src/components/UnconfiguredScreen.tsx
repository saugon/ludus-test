import { CONFIG_VARS } from '../config';
import { asset } from '../lib/paths';

const HELP: Record<string, string> = {
  [CONFIG_VARS.baseUrl]: 'La base de la API externa. En local: http://localhost:4010/api/external',
  [CONFIG_VARS.venue]: 'El slug del local que vende en la tienda.',
  [CONFIG_VARS.publishableKey]: 'Una clave publicable del local, que empieza con rst_pk_.',
};

export function UnconfiguredScreen({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-12">
      <section aria-labelledby="unconfigured-title" className="w-full max-w-xl space-y-6">
        <img src={asset('/logo.svg')} alt="" width={56} height={56} className="size-14" />
        <h1 id="unconfigured-title" className="text-6xl">
          Tienda sin configurar
        </h1>
        <p className="text-lg text-mute">
          La tienda todavía no está conectada con el comercio. {missing.length === 1 ? 'Falta esta variable' : 'Faltan estas variables'} de entorno:
        </p>
        <ul className="space-y-3">
          {missing.map((name) => (
            <li key={name} className="rounded-lg border border-line bg-ink-2 p-4">
              <code className="font-semibold text-ember-hi">{name}</code>
              <p className="mt-1 text-mute">{HELP[name]}</p>
            </li>
          ))}
        </ul>
        <p className="text-mute">
          Copiá <code className="text-bone">.env.example</code> a <code className="text-bone">.env.local</code>, completalo y reiniciá el servidor. El paso a paso está en el README, en «Conectar la tienda».
        </p>
      </section>
    </main>
  );
}
