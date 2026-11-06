import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeStorefront, sdkError, shopper, signedIn } from '../test/fakes';
import { withStore } from '../test/render';
import { CODE_RESEND_SECONDS, useShopper } from './ShopperProvider';

function setup(storefront = fakeStorefront()) {
  const hook = renderHook(() => useShopper(), { wrapper: withStore(storefront) });
  return { storefront, ...hook };
}

describe('ShopperProvider', () => {
  it('starts as a guest without asking the API when there is no saved session', () => {
    const { result, storefront } = setup();

    expect(result.current.status).toBe('guest');
    expect(storefront.shopper.get).not.toHaveBeenCalled();
  });

  it('restores a saved session with who is signed in', async () => {
    const { result } = setup(fakeStorefront({ shopper: signedIn() }));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('member'));
    expect(result.current.shopper).toEqual(shopper());
  });

  it('falls back to guest and flags the expiry when the saved session is no good', async () => {
    const { result } = setup(
      fakeStorefront({
        shopper: {
          isSignedIn: () => true,
          get: async () => {
            throw sdkError('shopper_unauthorized', 401);
          },
        },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('guest'));
    expect(result.current.expired).toBe(true);
    expect(result.current.shopper).toBeNull();
  });

  it('keeps the session but reports the error when the API cannot be reached', async () => {
    const failure = sdkError('timeout', null);
    const { result } = setup(
      fakeStorefront({
        shopper: {
          isSignedIn: () => true,
          get: async () => {
            throw failure;
          },
        },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(failure);
  });

  it('signs in straight away when the email already has an account', async () => {
    const { result, storefront } = setup();

    let answer: Awaited<ReturnType<typeof result.current.signIn>> | undefined;
    await act(async () => {
      answer = await result.current.signIn(' ana@example.com ', ' 123456 ');
    });

    expect(storefront.shopper.signIn).toHaveBeenCalledWith({ email: 'ana@example.com', code: '123456' });
    expect(answer).toEqual({ status: 'signed_in', shopper: shopper() });
    expect(result.current.status).toBe('member');
  });

  it('stays a guest until the new account gets its name', async () => {
    const { result, storefront } = setup(fakeStorefront({ shopper: { signIn: async () => ({ status: 'needs_name' }) } }));

    await act(() => result.current.signIn('nuevo@example.com', '123456'));
    expect(result.current.status).toBe('guest');

    await act(() => result.current.completeSignUp(' Nico Paz '));
    expect(storefront.shopper.completeSignUp).toHaveBeenCalledWith('Nico Paz');
    expect(result.current.status).toBe('member');
    expect(result.current.shopper?.name).toBe('Nico Paz');
  });

  it('signs out through the SDK', async () => {
    const { result, storefront } = setup(fakeStorefront({ shopper: signedIn() }));
    await waitFor(() => expect(result.current.status).toBe('member'));

    act(() => result.current.signOut());

    expect(storefront.shopper.signOut).toHaveBeenCalled();
    expect(result.current.status).toBe('guest');
    expect(result.current.expired).toBe(false);
  });

  it('counts down before the same email can ask for another code', async () => {
    const { result } = setup();
    expect(result.current.resendWait('ana@example.com')).toBe(0);

    await act(() => result.current.requestCode('ana@example.com'));

    expect(result.current.resendWait(' ANA@example.com ')).toBe(CODE_RESEND_SECONDS);
    expect(result.current.resendWait('otra@example.com')).toBe(0);
  });

  it('does not let a slow session check undo a sign-in that finished first', async () => {
    let answerCheck: (value: ReturnType<typeof shopper> | null) => void = () => {};
    const storefront = fakeStorefront({ shopper: { isSignedIn: () => true } });
    storefront.shopper.get.mockImplementationOnce(() => new Promise((resolve) => (answerCheck = resolve)));
    const { result } = setup(storefront);

    await act(() => result.current.signIn('ana@example.com', '123456'));
    await act(async () => answerCheck(null));

    expect(result.current.status).toBe('member');
    expect(result.current.shopper).toEqual(shopper());
  });
});
