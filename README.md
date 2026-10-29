# The Contractor's Course

I'm moving my original Webflow site to Vercel while preserving its landing page, design, copy, images, responsive styles, and Webflow interactions.

- My original published site: <https://the-contractors-course.webflow.io/>
- My Vercel address: <https://thecontractorscourse.vercel.app>
- My source repository: <https://github.com/christopherapeterson/the-contractors-course>

## Original design source

`webflow/raw-pages/` contains the unchanged HTML retrieved from my published Webflow site. `webflow/raw-css/` preserves the original downloaded stylesheets. `webflow/site/` contains the deployable copy, with presentation assets served locally and internal links pointing to the current host. `webflow/manifest.json` records source URLs, source hashes, served hashes, capture time, and observed redirects.

This is a capture of my publicly served site, rather than an official Webflow Designer ZIP export. I have removed the replacement frontend built earlier in this repository. The build copies my captured site directly instead of generating a new design. Checks compare every page's text, element structure, CSS classes, inline styles, and interaction IDs with the original source.

## Run and check

I use Node.js 22 or later and Python 3.10 or later. No npm dependencies are required.

```sh
npm ci
npm run build
npm run check
npm start
```

Vercel serves `dist/` with clean URLs. My local preview is <http://127.0.0.1:4173>.

`python3 scripts/mirror-webflow.py` can capture the published source again. It refuses to overwrite `webflow/`; I need to preserve the existing snapshot first and review a new capture before deploying it.

## Accounts, payments, and forms

My original login, signup, checkout, dashboard, and contact page designs are included. This static migration does not implement a new authentication, payment, enrollment, or contact-form backend. The source site includes legacy Webflow membership and commerce code, plus a Memberstack app running in test mode. External service scripts and Google Fonts remain dependencies, as they were on the source site.

I have not configured live billing or production authentication for this migration. I should finish those integrations before accepting registrations or purchases. The migration keeps original server redirects observed for protected pages; it does not turn successful navigation into proof of identity or payment. My `.com` DNS is a separate change from this deployment.

## Recovered course content

My original CSV files remain in `content/source/`, with framework-independent JSON in `content/`. These preserve 8 Law and Business items, 6 General B items, 81 flashcards, and 1 product. The 14 course collection items include 12 chapters and 2 external FlexiQuiz links. All 87 media assets referenced by the course material remain in `content/assets/`.

```sh
python3 scripts/import_content.py --check
```

I chose to make both my source code and course material public. This repository grants no new license to third-party material. Customer records and private credentials are not included. Pages protected by the original Webflow server were not bypassed or recovered by the public-page capture. My content backup is retained separately from the original page designs, and the study material has not received a factual or legal review.
