import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { readConfig } from './config';

const FULL = {
  VITE_STOREFRONT_BASE_URL: 'http://localhost:4010/api/external',
  VITE_STOREFRONT_VENUE: 'ludus',
  VITE_STOREFRONT_KEY: 'rst_pk_test_abc',
};

describe('readConfig', () => {
  it('returns the three values when every variable is set', () => {
    expect(readConfig(FULL)).toEqual({
      ok: true,
      config: { baseUrl: 'http://localhost:4010/api/external', venue: 'ludus', publishableKey: 'rst_pk_test_abc', homeDelivery: true },
    });
  });

  it('turns home delivery off only when VITE_HOME_DELIVERY says so', () => {
    const homeDelivery = (value?: string) => {
      const result = readConfig({ ...FULL, VITE_HOME_DELIVERY: value });
      return result.ok && result.config.homeDelivery;
    };
    expect(homeDelivery(undefined)).toBe(true);
    expect(homeDelivery('on')).toBe(true);
    expect(homeDelivery(' Off ')).toBe(false);
    expect(homeDelivery('false')).toBe(false);
    expect(homeDelivery('0')).toBe(false);
  });

  it('lists every missing variable, treating blank values as missing', () => {
    expect(readConfig({ VITE_STOREFRONT_VENUE: 'ludus', VITE_STOREFRONT_KEY: '   ' })).toEqual({
      ok: false,
      missing: ['VITE_STOREFRONT_BASE_URL', 'VITE_STOREFRONT_KEY'],
    });
    expect(readConfig({})).toEqual({
      ok: false,
      missing: ['VITE_STOREFRONT_BASE_URL', 'VITE_STOREFRONT_VENUE', 'VITE_STOREFRONT_KEY'],
    });
  });

  it('trims the values it reads', () => {
    const result = readConfig({ ...FULL, VITE_STOREFRONT_VENUE: '  ludus \n' });
    expect(result.ok && result.config.venue).toBe('ludus');
  });
});

describe('the unconfigured store', () => {
  it('shows the "Tienda sin configurar" screen naming only the missing variables', () => {
    render(<App env={{ VITE_STOREFRONT_VENUE: 'ludus' }} />);

    expect(screen.getByRole('heading', { name: 'Tienda sin configurar' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => within(item).getByText(/^VITE_/).textContent)).toEqual([
      'VITE_STOREFRONT_BASE_URL',
      'VITE_STOREFRONT_KEY',
    ]);
    expect(screen.queryByText('VITE_STOREFRONT_VENUE')).not.toBeInTheDocument();
    expect(screen.getByText(/http:\/\/localhost:4010\/api\/external/)).toBeInTheDocument();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the store instead once everything is set', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<App env={FULL} />);

    expect(screen.queryByRole('heading', { name: 'Tienda sin configurar' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Armá tu ejército.' })).toBeInTheDocument();
  });
});
