# The Contractor's Course

I'm moving my California contractor exam course from Webflow to GitHub and Vercel. This repository currently preserves my course content. The website migration is waiting for my Webflow code export.

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

## Website migration status

The Webflow Designer is at <https://the-contractors-course.design.webflow.com/>. Its publishing panel showed the staging domain as **Not published** when inspected. Code export is unavailable on the current Workspace plan. I am unlocking that export to preserve the original design more closely.

Next steps:

1. Download the official HTML, CSS, JavaScript, and asset ZIP after export is unlocked.
2. Preserve the exported design and rebuild CMS-bound pages using these JSON files.
3. Replace Webflow login and checkout, and connect this repository to Vercel.
4. Verify desktop and mobile layouts, every course page, flashcards, quiz links, contact forms, sign-in, and test checkout before launch.

The public [GitHub repository](https://github.com/christopherapeterson/the-contractors-course) is connected to my [Vercel project](https://vercel.com/chris-projects-f7cef533/the-contractors-course). The application, authentication, and payment flows are not deployed yet. No customer records or payment credentials are included. FlexiQuiz tests are preserved as external links; their underlying question banks have not been exported.

## Auth and payments

My proposed stack is Next.js on Vercel, Clerk for authentication, Stripe Checkout for payments, and Postgres for enrollment and learning progress. This is a proposal, not an active integration.

Clerk manages sign-in and sessions. Each protected server page, API route, and mutation must check identity and enrollment directly. Sign-in and payment status are separate checks.

Stripe hosts checkout. The server selects the price, associates the checkout with the signed-in user, and records enrollment only after verifying Stripe's webhook signature and the successful payment status. Webhook processing must be idempotent. Refunds and any future subscription changes must update enrollment according to the agreed product policy.

The exported product is **General-B Contractor's Course**, priced at **$299.00**, with a **$550.00** comparison price. The home design also contains **$199 yearly** text, which needs reconciliation before billing is implemented. I have no active customers to migrate. Existing practice test links use FlexiQuiz and can remain in place initially.

Because the lesson content is public in this repository, a future paid product would sell enrollment, progress tracking, support, or other added services. Authentication cannot make these public source files exclusive.

References: [Webflow export limitations](https://help.webflow.com/hc/en-us/articles/33961386739347-How-do-I-export-my-Webflow-site-code), [Webflow User Accounts retirement](https://help.webflow.com/hc/en-us/articles/36046006227731-User-Accounts-sunset), [Clerk server-side protection](https://clerk.com/docs/nextjs/guides/secure/protect-content), [Stripe post-payment events](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted).
