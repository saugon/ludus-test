import { createStorefront, type Storefront } from '@vertex/storefront-sdk';
import { useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from './cart/CartProvider';
import { CartStep } from './checkout/CartStep';
import { CheckoutProvider } from './checkout/CheckoutProvider';
import { PaymentStep } from './checkout/PaymentStep';
import { ShippingStep } from './checkout/ShippingStep';
import { Layout } from './components/Layout';
import { UnconfiguredScreen } from './components/UnconfiguredScreen';
import { readConfig, type StoreConfig } from './config';
import { routerBase } from './lib/paths';
import { ProductsProvider, StorefrontProvider } from './lib/storefront';
import { Account } from './pages/Account';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Order } from './pages/Order';
import { ProductDetail } from './pages/ProductDetail';
import { Products } from './pages/Products';
import { SignIn } from './pages/SignIn';
import { ShopperProvider } from './shopper/ShopperProvider';

export function StoreRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="productos" element={<Products />} />
        <Route path="productos/:code" element={<ProductDetail />} />
        <Route path="checkout" element={<CartStep />} />
        <Route path="checkout/envio" element={<ShippingStep />} />
        <Route path="checkout/pago" element={<PaymentStep />} />
        <Route path="pedido" element={<Order />} />
        <Route path="ingresar" element={<SignIn />} />
        <Route path="cuenta" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function Store({ config, storefront }: { config: StoreConfig; storefront: Storefront }) {
  return (
    <StorefrontProvider storefront={storefront}>
      <ProductsProvider>
        <ShopperProvider venue={config.venue}>
          <CartProvider venue={config.venue}>
            <CheckoutProvider homeDelivery={config.homeDelivery}>
              <StoreRoutes />
            </CheckoutProvider>
          </CartProvider>
        </ShopperProvider>
      </ProductsProvider>
    </StorefrontProvider>
  );
}

export function App({ env = import.meta.env }: { env?: Record<string, string | boolean | undefined> }) {
  const result = useMemo(() => readConfig(env), [env]);
  const storefront = useMemo(() => {
    if (!result.ok) return null;
    const { baseUrl, venue, publishableKey } = result.config;
    return createStorefront({ baseUrl, venue, publishableKey });
  }, [result]);

  if (!result.ok || !storefront) return <UnconfiguredScreen missing={result.ok ? [] : result.missing} />;

  return (
    <BrowserRouter basename={routerBase}>
      <Store config={result.config} storefront={storefront} />
    </BrowserRouter>
  );
}
