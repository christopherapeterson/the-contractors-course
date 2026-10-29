# The Contractor's Course

I'm hosting my California contractor exam course on Vercel, with the source and course material in this public repository.

Production address: <https://thecontractorscourse.vercel.app>

The site includes a responsive homepage, a searchable chapter library, 12 reading pages with local illustrations, an 81-card review deck, and the original FlexiQuiz practice test links. Chapter completion and learned flashcards persist in the visitor's browser. No sign-in or payment is required for this public version.

## Run the website

Node.js 22 or later is required.

~~~sh
npm ci
npm run build
npm run check
npm start
~~~

The site builds to dist/. Vercel serves the generated HTML with clean URLs. The local preview uses Python 3 and serves the same routes at <http://127.0.0.1:4173>. The build sanitizes imported HTML and rewrites course images to locally hosted assets.

## Recovered content

| Collection | Items |
| --- | ---: |
| Law and Business | 8 |
| General B | 6 |
| Flashcards | 81 |
| Course product | 1 |

The 14 course collection items include 12 chapters and 2 practice test links. Original CSV files are in `content/source/`. Framework-independent JSON is in `content/`. The import preserves rich HTML, Webflow IDs, slugs, source timestamps, and external practice test links. Linked media and download results are tracked in `content/assets-manifest.json`.

I chose to make both the source code and course material public. This repository does not grant a new license to third-party materials referenced by the original course.

## Regenerate and verify

Python 3.10 or later is sufficient. No third-party dependencies are required.

```sh
python3 scripts/import_content.py
python3 scripts/import_content.py --check
python3 scripts/download_assets.py
```

`--check` validates collection sizes, required fields, unique slugs and IDs, and generated JSON against the source exports. Downloads use only media URLs found in the exported course content.

## Design and content migration

The source Webflow Designer is at <https://the-contractors-course.design.webflow.com/>. Its publishing panel showed the staging domain as **Not published** when inspected. Official code export requires a paid Workspace plan.

I chose to launch from my recovered repository content with a new responsive study interface. This version does not require a Webflow plan. An official design export can still be incorporated later if I want a closer match to the original Webflow layout.

The [GitHub repository](https://github.com/christopherapeterson/the-contractors-course) is connected to my [Vercel project](https://vercel.com/chris-projects-f7cef533/thecontractorscourse). No customer records or payment credentials are included. FlexiQuiz tests are preserved as external links; their underlying question banks have not been exported. The source study material is preserved as supplied and has not received a factual or legal review.

## Auth and payments

The current site is public and static. If I add accounts or paid services later, my proposed stack is Next.js on Vercel, Clerk for authentication, Stripe Checkout for payments, and Postgres for enrollment and learning progress. These services are not active integrations.

Clerk manages sign-in and sessions. Each protected server page, API route, and mutation must check identity and enrollment directly. Sign-in and payment status are separate checks.

Stripe hosts checkout. The server selects the price, associates the checkout with the signed-in user, and records enrollment only after verifying Stripe's webhook signature and the successful payment status. Webhook processing must be idempotent. Refunds and any future subscription changes must update enrollment according to the agreed product policy.

The exported product is **General-B Contractor's Course**, priced at **$299.00**, with a **$550.00** comparison price. The home design also contains **$199 yearly** text, which needs reconciliation before billing is implemented. I have no active customers to migrate. Existing practice test links use FlexiQuiz and can remain in place initially.

Because the lesson content is public in this repository, a future paid product would sell enrollment, progress tracking, support, or other added services. Authentication cannot make these public source files exclusive.

References: [Webflow export limitations](https://help.webflow.com/hc/en-us/articles/33961386739347-How-do-I-export-my-Webflow-site-code), [Webflow User Accounts retirement](https://help.webflow.com/hc/en-us/articles/36046006227731-User-Accounts-sunset), [Clerk server-side protection](https://clerk.com/docs/nextjs/guides/secure/protect-content), [Stripe post-payment events](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted).
