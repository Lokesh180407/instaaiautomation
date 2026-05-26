# TODO

## Critical webhook fix (Meta Instagram)
- [ ] Step 1: Update `supabase/functions/instagram-webhook/index.ts` to implement exact Meta verification handshake for **GET** and **POST**.
- [ ] Step 2: Ensure response bodies/status codes exactly match the required implementation snippet.
- [ ] Step 3: Keep existing POST event handling, but guarantee the webhook responds with `EVENT_RECEIVED` status 200 for POST in the verification-safe mode.
- [ ] Step 4: Deploy function: `supabase functions deploy instagram-webhook`.
- [ ] Step 5: Test in browser with provided verify URL and confirm response is exactly the `hub.challenge` value.
- [ ] Step 6: If browser test passes, return to Meta Dashboard and click Verify + Save.

