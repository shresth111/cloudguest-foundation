# ISP partner UI smoke

`partner-smoke.mjs` signs in to the partner console and opens every partner
page and tab, failing a page on console errors, uncaught page errors, API
responses >= 500 (or >= 400 unless the body says the feature is switched
off), and blank screens / the error boundary. One screenshot per page.

Credentials come from `PARTNER_EMAIL` / `PARTNER_PASSWORD` only. It refuses
production hosts. Run it on the test box inside the official Playwright
image (matching the repo's `playwright` version), e.g.:

    docker run --rm --ipc=host -v "$PWD:/w" -w /w \
      -e PARTNER_BASE_URL=https://network-staging.wyfyguest.com \
      -e PARTNER_EMAIL -e PARTNER_PASSWORD -e OUT_DIR=/w/out \
      mcr.microsoft.com/playwright:v1.61.1-noble \
      node e2e/isp-partner/partner-smoke.mjs

The working directory needs `node_modules/playwright` and
`node_modules/playwright-core` (the image ships the browsers, not the npm
package).
