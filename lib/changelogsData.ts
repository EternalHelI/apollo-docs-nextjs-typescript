export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  time: string;
  title: string;
  summary: string;
  sections: ChangelogSection[];
}

// IMPORTANT: Keep this append-only in descending version order.
// New entries must be added at the top, and existing entries should never be removed.

export const CHANGELOGS: ChangelogEntry[] = [
{
  version: 'v3.1.6',
  date: '2025-12-22',
  time: '7:37 PM PST',
  title: 'Fix: welcome content reliability + hydration autosave guard',
  summary: 'Hardened editor hydration so the intro content reliably appears for new/empty documents, and prevented early hydration updates from overwriting content or confusing the save-status pill.',
  sections: [
    {
      title: 'Editor',
      items: [
        'Ignored TipTap update events during initial hydration to prevent an early empty autosave from overwriting seeded content.',
        'Added a durable per-document “user started” marker so intro injection only happens for docs that have never been edited.',
        'If a document snapshot is missing, corrupted, or still effectively empty, the editor now seeds and persists the intro content immediately.'
      ]
    }
  ]
},
{
  version: 'v3.1.5',
  date: '2025-12-22',
  time: '3:52 PM PST',
  title: 'New documents: guaranteed welcome content injection',
  summary: 'Ensured every brand-new (or effectively empty) document displays the introductory content by injecting it with TipTap insertContent and persisting immediately.',
  sections: [
    {
      title: 'Editor',
      items: [
        'Added a one-time intro injection path for empty docs using TipTap insertContent (nodes array) to avoid edge cases where an early empty snapshot can overwrite the seeded template.',
        'Introduced a per-document intro seed flag (localStorage) so the welcome content is only injected once and won\'t reappear if a user later clears a document intentionally.'
      ]
    }
  ]
},
{
  version: 'v3.1.4',
  date: '2025-12-22',
  time: '3:25 PM PST',
  title: 'Editor bar: full-width layout + Loading status fix',
  summary: 'Updated the editor document bar to behave like a second, full-width navbar and hardened the initial hydration path so the status pill no longer gets stuck on Loading.',
  sections: [
    {
      title: 'Editor header',
      items: [
        'Made the document bar full-width and aligned it directly under the primary navbar.',
        'Added visible labels for Document Name and Heading, while keeping screen-reader labels for accessibility.',
        'Improved Heading dropdown readability in dark mode by setting appropriate native color-scheme defaults.'
      ]
    },
    {
      title: 'Save status reliability',
      items: [
        'Fixed a state hydration gap that could leave the status pill stuck on Loading when creating a new document.',
        'Added a small safety fallback to transition to Ready if hydration is interrupted.'
      ]
    },
    {
      title: 'New documents',
      items: [
        'Seed new documents with the standard introductory content at creation time so every new document opens with helpful starter text.'
      ]
    }
  ]
},
{
  version: 'v3.1.3',
  date: '2025-12-22',
  time: '2:57 PM PST',
  title: 'Build fix: restore APP_NAME export',
  summary: 'Restored the missing APP_NAME export in lib/version.ts that caused builds to fail when SiteFooter imported it.',
  sections: [
    {
      title: 'Build',
      items: [
        'Added APP_NAME export to lib/version.ts and kept APP_VERSION export stable for server/client imports.',
        'Bumped version constants to 3.1.3.'
      ]
    }
  ]
},
{
  version: 'v3.1.2',
  date: '2025-12-22',
  time: '2:55 PM PST',
  title: 'Build fix: Turbopack changelog string parsing',
  summary: 'Fixed a TypeScript string quoting issue in the v3.1.1 changelog that caused Turbopack to fail during build.',
  sections: [
    {
      title: 'Build',
      items: [
        'Escaped/normalized the “Couldn\'t save” changelog bullet so it no longer terminates a single-quoted TypeScript string.',
        'No runtime behavior changes; this release only unblocks Next.js builds.'
      ]
    }
  ]
},
{
  version: 'v3.1.1',
  date: '2025-12-22',
  time: '2:40 PM PST',
  title: 'Editor header compaction + autosave status fix',
  summary: 'Made the editor top bar more compact, fixed the save status getting stuck, and strengthened favicon/legacy-storage handling.',
  sections: [
    {
      title: 'Editor UI',
      items: [
        'Reworked the editor header into a compact 3-zone layout (document name + status | document settings toolbar | actions).',
        'Moved the TipTap toolbar into the sticky header so document settings are directly connected to the document name and actions.',
        'Made page break guides more visible with a thicker, subtle band near the bottom of each Letter page.'
      ]
    },
    {
      title: 'Save status',
      items: [
        'Implemented an autosave status flow with animated dots while typing (Autosaving., Autosaving.., Autosaving...).',
        'When a save completes, the status now shows an exact timestamp (Saved @ HH:MM AM/PM).',
        "Added clear red error states for failed saves (e.g., “Couldn't save”)."
      ]
    },
    {
      title: 'Assets & storage cleanup',
      items: [
        'Added app/icon.svg and public/favicon.svg and updated metadata icons so the rocket favicon resolves reliably.',
        'Removed all Quill Delta snapshot storage/migration paths from the editor and archive/trash storage.'
      ]
    }
  ]
},
{
  version: 'v3.0.0',
  date: '2025-12-21',
  time: '11:55 PM PST',
  title: 'Editor overhaul: TipTap + interaction fixes',
  summary: 'Replaced the Quill editor with TipTap and fixed dropdown/menu interactions that prevented in-menu buttons (theme, view mode, options) from firing in the Next.js/React build.',
  sections: [
    {
      title: 'Editor',
      items: [
        'Removed Quill entirely and implemented the document editor with TipTap (Starter Kit + Underline + Link + Placeholder).',
        'Added a lightweight TipTap toolbar with headings, inline formatting, lists, blockquote, code blocks, links, and a clear-format action.',
        'Kept “Save As” exports (JSON/PDF/DOCX/ODT) by generating output from editor HTML, with CDNs still used only for export libraries.'
      ]
    },
    {
      title: 'UI reliability',
      items: [
        'Fixed a React event propagation conflict in the dropdown menu controller that prevented button onClick handlers from firing inside open menus.',
        'Dark mode/light mode, list/grid toggles, and Options dropdown actions now work consistently across pages.'
      ]
    },
    {
      title: 'Storage compatibility',
      items: [
        'Introduced a new TipTap content key (`apollo_docs_doc_<id>_content_v2`) while preserving the legacy Quill Delta key for backward compatibility.',
        'Added a best-effort legacy migration path: if only a Quill Delta exists, the editor will import the plain text into TipTap on first open.'
      ]
    }
  ]
},
{
  version: 'v2.0.4',
  date: '2025-12-21',
  time: '10:15 PM PST',
  title: 'Fix: Vercel prerender bailout hardening + Next 16 pin',
  summary: 'Hardened the /editor route against static prerender bailouts and aligned dependencies with the intended Next.js version while removing build-time viewport warnings.',
  sections: [
    {
      title: 'Build & Deployment',
      items: [
        'Pinned Next.js dependency to 16.1.0 to match the deployment target and avoid unexpected minor upgrades during CI installs.',
        'Forced the /editor route to render dynamically to prevent static prerender failures related to CSR bailout constraints.',
        'Removed an unnecessary viewport meta tag from the print iframe template to reduce viewport-related build warnings and keep viewport configuration solely in Next metadata exports.'
      ]
    }
  ]
},
{
  version: 'v2.0.3',
  date: '2025-12-21',
  time: '9:58 PM PST',
  title: 'Fix: Next.js 15 build error + metadata warnings',
  summary: 'Resolved a Next.js 15 prerender/build failure on /editor and removed unsupported metadata viewport configuration warnings.',
  sections: [
    {
      title: 'Next.js App Router',
      items: [
        'Removed useSearchParams() from the /editor route by passing searchParams from the server page into a client component, eliminating the missing Suspense boundary prerender error.',
        'Moved viewport configuration from metadata export to a dedicated viewport export in the root layout (Next.js 15+ compliant).' 
      ]
    }
  ]
},
{
  version: 'v2.0.2',
  date: '2025-12-21',
  time: '9:28 PM PST',
  title: 'Fix: toast hook API mismatch (Vercel build)',
  summary: 'Resolved a TypeScript compilation failure caused by inconsistent useToast() return shapes across pages.',
  sections: [
    {
      title: 'Build & UI',
      items: [
        'Updated /editor to use the same toast hook contract as /homepage and /archive (toast.refs + toast.show).',
        'Extended useToast() to expose both direct refs (toastRef/textRef/timerRef) and grouped refs (refs.*) for backwards-compatible call sites.'
      ]
    }
  ]
},
{
  version: 'v2.0.1',
  date: '2025-12-21',
  time: '9:30 PM PST',
  title: 'Build fixes: missing exports + strict TS refs',
  summary: 'Resolved Next.js/Vercel build failures by restoring expected exports and correcting strict TypeScript ref typings.',
  sections: [
    {
      title: 'Build & TypeScript',
      items: [
        'Added backward-compatible word count preference exports (loadWordCountEnabled/storeWordCountEnabled).',
        'Added touchDoc export to docs store to match editor imports.',
        'Relaxed ToastHost ref prop typing to accept nullable refs (RefObject<HTMLDivElement | null>) for strictNullChecks compatibility.'
      ]
    }
  ]
},
{
  version: 'v2.0.0',
  date: '2025-12-21',
  time: '7:15 PM PST',
  title: 'TypeScript + Next.js migration',
  summary: 'Migrated Apollo Documents from a static HTML/JS bundle into a TypeScript-first Next.js app (App Router) while preserving the existing local-only storage model and UI behavior.',
  sections: [
    {
      title: 'TypeScript foundation',
      items: [
        'Converted shared logic (storage keys, persistence, time/format helpers, menus, page loader, toast controller) into typed modules.',
        'Centralized document + archive operations in a typed docs store to remove duplicated logic across pages.',
        'Preserved the existing localStorage key schema so existing users keep their data.'
      ]
    },
    {
      title: 'Next.js App Router',
      items: [
        'Implemented routes as requested: /homepage, /archive, /editor, /changelogs (no file extensions).',
        'Added redirects for legacy URLs (index.html, trash.html, editor.html, changelogs.html) for smoother transitions.',
        'Moved assets and fonts into /public and updated paths accordingly.'
      ]
    },
    {
      title: 'Operational notes',
      items: [
        'This is a major-version change (v2.0.0) due to the build/runtime architecture shift.',
        'No backend was added; documents remain local-only (accounts/auth can be layered in later).'
      ]
    }
  ]
},
{
  version: 'v1.9.26',
  date: '2025-12-21',
  time: '6:52 PM PST',
  title: 'Shared utilities extraction',
  summary: 'Extracted common JavaScript helpers into a dedicated utilities file and refactored page scripts to reduce duplication (behavior preserved).',
  sections: [
    {
      title: 'New shared file',
      items: [
        'Added utilities.js for common helpers: page loader, localStorage JSON wrappers, ID generation, menu wiring, toast controller, and download helpers.'
      ]
    },
    {
      title: 'Refactors',
      items: [
        'Updated docs.js, trash.js, editor.js, and changelogs.js to consume shared helpers via window.ApolloUtils.',
        'Updated all pages to load utilities.js before their page script (defer order preserved).'
      ]
    },
    {
      title: 'Compatibility and stability',
      items: [
        'Kept the existing local-only storage model and UI behavior intact; this is a maintainability cleanup.'
      ]
    }
  ]
},
{
  version: 'v1.9.25',
  date: '2025-12-21',
  time: '6:10 PM PST',
  title: 'ES2023 baseline and stability pass',
  summary: 'Standardized the project on ES2023 and made targeted reliability and performance improvements (no UI changes).',
  sections: [
    {
      title: 'JavaScript baseline',
      items: [
        'Updated project documentation to ES2023 as the supported JavaScript baseline.',
        'Hardened download handling (safer object URL revocation timing for Safari).',
        'Removed a duplicate “Socials” click handler on the Home page to prevent double toasts.'
      ]
    },
    {
      title: 'Archive performance',
      items: [
        'Archive countdown timers now update in-place each second instead of re-rendering the entire list, improving performance for larger archives.',
        'Restored-document IDs now prefer crypto.randomUUID/getRandomValues when available for stronger uniqueness.'
      ]
    },
    {
      title: 'UI consistency',
      items: [
        'Archive page permanent-delete icon now matches the Home page trash icon (stroke-based SVG).',
        'Fixed invalid nested <main> markup in the Changelog page.'
      ]
    }
  ]
},

{
  version: 'v1.9.24',
  date: '2025-12-21',
  time: '5:49 PM PST',
  title: 'ES2020 baseline and code-quality pass',
  summary: 'Standardized the project on ES2020 (Safari 26.x+, iOS 18.6+) and improved code quality and compatibility without changing the UI.',
  sections: [
    {
      title: 'Compatibility',
      items: [
        'Removed ES2021-only String.replaceAll usage to keep the JavaScript baseline strictly ES2020.',
        'New document IDs now prefer crypto.getRandomValues when available for more robust uniqueness.'
      ]
    },
    {
      title: 'Maintenance',
      items: [
        'Updated README browser-compatibility targets to reflect ES2020 / Safari 26.x+ / iOS 18.6+.'
      ]
    }
  ]
},

{
  version: 'v1.9.23',
  date: '2025-12-21',
  time: '5:35 PM PST',
  title: 'Mobile Info icon-only and scrollable Options menus',
  summary: 'Improved small-screen usability by hiding the Info button label on mobile and making dropdown menus scrollable so nested actions like “Save As” remain reachable.',
  sections: [
    {
      title: 'Mobile',
      items: [
        'On the Home page, the Info menu trigger now displays as icon-only on small screens.'
      ]
    },
    {
      title: 'Menus',
      items: [
        'Dropdown menus now have a max-height and internal scrolling, preventing tall menus from extending off-screen on mobile.',
        'This fixes cases where “Save As” could be unreachable within the Editor Options dropdown on smaller displays.'
      ]
    }
  ]
},

{
  version: 'v1.9.23',
  date: '2025-12-21',
  time: '3:45 PM PST',
  title: 'Print hover contrast in Light theme',
  summary: 'Improved Print button hover contrast in Light theme by switching the label and icon to black on hover while keeping the default white-on-accent styling.',
  sections: [
    {
      title: 'UI',
      items: [
        'In Light theme, hovering the Print button now changes its text color to black and renders the print icon in black.',
        'Default Light theme state remains unchanged: the Print icon and label stay white on the accent button when not hovered.'
      ]
    }
  ]
},

{
  version: 'v1.9.21',
  date: '2025-12-21',
  time: '3:33 PM PST',
  title: 'Private browsing warning and light-theme icon fixes',
  summary: 'Added a private/incognito storage warning modal and ensured key action icons remain white on accent buttons in Light theme.',
  sections: [
    {
      title: 'Storage & Safety',
      items: [
        'Detect likely private/incognito browsing or restricted storage and show a one-time warning modal about local browser storage.',
        'Include a “Don’t show again” option (stored in localStorage when available).'
      ]
    },
    {
      title: 'UI',
      items: [
        'Keep the Home “Archive” trash icon white in Light theme.',
        'Keep the Editor “Print” icon white in Light theme.'
      ]
    }
  ]
},

{
  version: 'v1.9.20',
  date: '2025-12-21',
  time: '3:12 PM PST',
  title: 'Sticky formatting toolbar and Archive icon fixes',
  summary: 'Pinned the full Quill formatting toolbar under the document bar, added the new trash icon to the Home Archive button, updated Archive page delete icons, and improved the reliability of on-screen Letter page-break guides.',
  sections: [
    {
      title: 'Editor',
      items: [
        'Quill formatting toolbar (heading, font size, alignment, formatting, lists, indents, links, etc.) now lives in a sticky toolstrip directly under the document bar so the full toolset follows the viewport.',
        'Alignment control now matches the same hover/press motion behavior as other editor controls for consistent interaction feedback.',
        'Letter page-break guides now render more reliably by keeping Quill content auto-sized (no internal scrolling) and avoiding background-attachment: local edge cases on some browsers.'
      ]
    },
    {
      title: 'Home and Archive',
      items: [
        'Home page Archive button now includes the new trash icon alongside the label.',
        'Archive page permanent-delete buttons now use the same new trash icon for consistent visual language.'
      ]
    }
  ]
},

{
  version: 'v1.9.19',
  date: '2025-12-21',
  time: '12:22 PM PST',
  title: 'Doc bar pinned under navbar and icon updates',
  summary: 'Moved the document name/actions into a compact sticky bar beneath the navbar, updated the Home page Info and Trash icons, and refined editor polish for alignment hover motion and page-break guides.',
  sections: [
    {
      title: 'Editor',
      items: [
        'Document name and actions (Home, Options, Print) now live in a sticky document bar below the navbar so they stay visible while you scroll.',
        'Alignment picker now uses the same hover/press motion as other toolbar icons for consistent interaction feedback.',
        'Letter page-break guides now scroll with editor content (background-attachment: local) so the guide lines track the document instead of the viewport.'
      ]
    },
    {
      title: 'Home (Documents)',
      items: [
        'Info dropdown trigger now uses the new info-circle icon.',
        'Per-document Trash action now uses the new trash icon path while preserving theme tinting.'
      ]
    }
  ]
},

{
  version: 'v1.9.18',
  date: '2025-12-21',
  time: '11:34 AM PST',
  title: 'Mobile page-break guides adjusted',
  summary: 'Improved the on-screen Letter page-break guide spacing on narrow screens so breaks don’t appear prematurely due to mobile line-wrapping. Printing remains unaffected.',
  sections: [
    {
      title: 'Editor',
      items: [
        'Page-break guides now adapt on narrow viewports by modestly increasing guide spacing based on the editor’s text column width.',
        'Guide adjustment is clamped to prevent extreme spacing on very small screens.',
        'Print output is unchanged (guides remain disabled in print media).'
      ]
    }
  ]
},

{
  version: 'v1.9.17',
  date: '2025-12-21',
  time: '9:31 AM PST',
  title: 'Smoother Save As submenu close animation',
  summary: 'Improved the Save As submenu motion so it collapses smoothly (including layout) without the “wait then snap” effect when closing.',
  sections: [
    {
      title: 'Editor Options',
      items: [
        'Save As submenu now animates height/padding/margins while closing, preventing an abrupt layout snap at the end of the transition.',
        'Closing the Options menu now collapses any nested submenus (like Save As) at the same time to avoid stale open-state when reopening.'
      ]
    }
  ]
},

{
  version: 'v1.9.16',
  date: '2025-12-21',
  time: '5:17 PM PST',
  title: 'Mobile icon-only header actions and Info menu on Home',
  summary: 'On small screens, the Home, Print, and Options actions now render as icon-only buttons. The Changelog link was removed from all Options dropdowns and is now available only from a new Info dropdown on the Home page (with a Socials placeholder).',
  sections: [
    {
      title: 'Navigation',
      items: [
        'Added an Info dropdown on the Home page with a Changelog link and a Socials placeholder item.',
        'Removed the Changelog link from all Options dropdown menus to keep Options focused on settings.'
      ]
    },
    {
      title: 'Mobile polish',
      items: [
        'Home, Print, and Options buttons collapse to icon-only on mobile breakpoints (with aria-labels preserved).'
      ]
    }
  ]
},


{
  version: 'v1.9.15',
  date: '2025-12-21',
  time: '4:05 PM PST',
  title: 'Quill toolbar pickers restored to Snow defaults',
  summary: 'Reverted Heading, Font Size, and the collapsed Alignment picker to Quill Snow’s original clean text/icon styling while keeping the site’s theme colors and dropdown spacing.',
  sections: [
    {
      title: 'Editor toolbar',
      items: [
        'Restored the original Quill Snow markup for Heading and Font Size pickers (removed custom label stacks).',
        'Removed pill-style picker padding/background so the controls render as clean text like default Snow.',
        'Removed alignment picker scaling/width overrides so the collapsed alignment icon matches Quill’s default sizing.'
      ]
    }
  ]
},

{
  version: 'v1.9.14',
  date: '2025-12-21',
  time: '3:25 PM PST',
  title: 'Quill toolbar layout refinements',
  summary: 'Reworked Heading/Font Size labels into stacked controls, improved spacing between the document title area and toolbar, and restored a larger centered alignment icon on the collapsed picker.',
  sections: [
    {
      title: 'Editor toolbar',
      items: [
        'Moved the Heading and Font Size labels above their pickers (stacked layout).',
        'Adjusted editor header padding so the document name field and toolbar do not feel cramped.',
        'Centered the picker label text for Heading and Font Size.',
        'Restored a larger, centered alignment icon in the collapsed alignment picker while keeping dropdown icons unchanged.'
      ]
    }
  ]
},

{
  version: 'v1.9.13',
  date: '2025-12-21',
  time: '2:35 PM PST',
  title: 'Quill toolbar polish: spacing, labels, and icon sizing',
  summary: 'Adjusted Quill picker dropdown spacing, restored default alignment icon sizing, and added small labels for Heading and Font Size.',
  sections: [
    {
      title: 'Editor toolbar',
      items: [
        'Added compact labels for Heading and Font Size for faster scanning.',
        'Increased dropdown offset so menus do not sit flush against picker labels.',
        'Removed custom icon-sizing overrides and restored Quill’s default alignment icon sizing in picker dropdowns.'
      ]
    }
  ]
},
{
  version: 'v1.9.11',
  date: '2025-12-21',
  time: '8:25 AM PST',
  title: 'Fix: top color bar aligns perfectly with cards (list + grid)',
  summary: 'Reworked the document accent line rendering so it sits flush with the card border and follows the corner radius precisely in both list and grid layouts.',
  sections: [
    {
      title: 'Document cards',
      items: [
        'Moved the 4px accent line from an absolutely-positioned pseudo-element to a layered background so it renders at the true border edge (no 1px vertical offset).',
        'Ensured the accent line follows the card\'s border-radius cleanly at both corners, eliminating squared edges and micro-gaps.'
      ]
    }
  ]
},

{
  version: 'v1.9.10',
  date: '2025-12-20',
  time: '11:55 AM PST',
  title: 'Fix: document icon reliably renders on the documents list',
  summary: 'Resolved an issue where the document icon could be missing/invisible by rendering it via markup (img) rather than a pseudo-element, and preserving the icon during inline rename.',
  sections: [
    {
      title: 'Documents list',
      items: [
        'Document titles now render a local SVG icon via an <img> element to ensure consistent display across browsers.',
        'Inline rename now preserves the icon during editing and restores it cleanly on cancel/commit.'
      ]
    },
    {
      title: 'Archive',
      items: [
        'Archive list titles now display the same document icon for visual consistency.'
      ]
    }
  ]
},
{
  version: 'v1.9.9',
  date: '2025-12-20',
  time: '11:35 AM PST',
  title: 'Changelog grid mode, icons, and loader timing',
  summary: 'Added a grid layout option for the changelog, implemented local SVG icons (document title + Print), and shortened the page-load indicator to 0.5s. Toast notifications now use a clearer slide-down/slide-up motion.',
  sections: [
    {
      title: 'Changelog',
      items: [
        'Added a grid mode toggle in Options for the changelog timeline.',
        'Changelog now persists theme using the same storage key as the rest of the site (with a legacy fallback).'
      ]
    },
    {
      title: 'Icons',
      items: [
        'Added a local document icon displayed before document titles (non-editable).',
        'Added a local Print icon to the Print button in the editor.'
      ]
    },
    {
      title: 'UI Motion',
      items: [
        'Shortened the page loader to 0.5 seconds (respects prefers-reduced-motion).',
        'Adjusted toast notification motion to slide down into place and slide back up when dismissed.'
      ]
    }
  ]
},
{
  version: 'v1.9.8',
  date: '2025-12-20',
  time: '11:10 AM PST',
  title: 'UI motion pass: buttons, menus, modals, and toasts',
  summary: 'Added subtle, accessibility-aware animations across core UI components (buttons, dropdowns, modals, and notifications) plus a brief page-load indicator.',
  sections: [
    {
      title: 'UI Motion',
      items: [
        'Added a gentle bounce interaction to primary buttons, menu items, icon buttons, and Quill toolbar buttons.',
        'Animated Options dropdown open/close (including the Save As sub-menu) for clearer state changes.',
        'Animated modal open/close transitions on Changelog and Archive delete confirmation.',
        'Animated toast notifications with a short slide/fade entrance and exit.',
        'Added a 1-second non-blocking page loader indicator (respects prefers-reduced-motion).'
      ]
    }
  ]
},
{
  version: 'v1.9.7',
  date: '2025-12-20',
  time: '3:45 AM PST',
  title: 'Printing fix: dedicated print renderer',
  summary: 'Replaced in-place printing with a hidden iframe print renderer to avoid scroll-viewport printing, scrollbar artifacts, and missing pages in long documents.',
  sections: [
    {
      title: 'Printing',
      items: [
        'Built a print-only HTML document from the current editor content (Quill root HTML).',
        'Printed that document from a hidden same-origin iframe so the browser prints the full flow content (not the on-screen scroll viewport).',
        'Added additional print CSS hardening to prevent overflow clipping and to suppress on-screen page guides in print output.'
      ]
    }
  ]
},

{
  version: 'v1.9.6',
  date: '2025-12-20',
  time: '2:41 AM PST',
  title: 'Printing pagination and Letter page guides',
  summary: 'Fixed printing so the full document paginates correctly (no scrollbars, no “current viewport only” printing), and added Letter-size page-break guides in the editor.',
  sections: [
    {
      title: 'Printing',
      items: [
        'Adjusted print CSS so Quill content prints with overflow visible and auto height.',
        'Ensures multi-page documents paginate correctly regardless of scroll position.',
        'Removed the editor scrollbar from print output.'
      ]
    },
    {
      title: 'Editor',
      items: [
        'Added subtle Letter-size visual page-break guide lines while editing.',
        'Guides are purely visual and do not change your saved content.'
      ]
    }
  ]
},
    {
      version: 'v1.9.5',
      date: '2025-12-20',
      time: '10:30 AM PST',
      title: 'Maintenance and documentation pass',
      summary: 'Stabilized changelog/archive scripts, added internal documentation, and hardened title rendering without changing the site layout.',
      sections: [
        {
          title: 'Stability',
          items: [
            'Fixed JavaScript parse errors that prevented Changelog and Archive from rendering.',
            'Ensured hidden modal backdrops cannot block clicks.',
            'Standardized changelog timestamps to 12-hour AM/PM PST.'
          ]
        },
        {
          title: 'Maintainability',
          items: [
            'Added file-level documentation blocks for easier future maintenance.',
            'Centralized small helper utilities (HTML escaping) where innerHTML is used.'
          ]
        }
      ]
    },
    {
      version: 'v1.9.2',
      date: '2025-12-20',
      time: '1:06 AM PST',
      title: 'Changelog retention fix',
      summary: 'Restored the full changelog history and established an append-only convention for future releases.',
      sections: [
        {
          title: 'Changelog',
          items: [
            'Restored missing historical entries.',
            'Added time display (PST) in list rows and modals when available.',
            'Future updates will only append new entries (no removals).'
          ]
        }
      ]
    },
{
      version: 'v1.9.1',
      date: '2025-12-20',
      time: '1:06 AM PST',
      title: 'Save As submenu wiring fix',
      summary: 'Fixed the Save As click handler so the format submenu opens and the four format buttons trigger the correct downloads.',
      sections: [
        {
          title: 'Bugfix',
          items: [
            'Save As now toggles the format submenu as intended.',
            'JSON/PDF/DOCX/ODT buttons now call the correct export actions.'
          ]
        }
      ]
    },
    {
      version: 'v1.9.0',
      date: '2025-12-20',
      time: '1:06 AM PST',
      title: 'Save As submenu now includes export formats',
      summary: 'Moved PDF/DOCX/ODT exports under Save As as a secondary dropdown alongside JSON.',
      sections: [
        {
          title: 'Editor',
          items: [
            'Removed the separate Export section from Options.',
            'Save As now opens a format chooser: JSON, PDF, DOCX, ODT.',
            'Format selection keeps Options open and collapses the submenu after downloading.'
          ]
        }
      ]
    },
    {
      version: 'v1.8.2',
      date: '2025-12-20',
      time: '—',
      title: 'Local icons for Home and Options',
      summary: 'Bundled the Home and Options icons locally to avoid external requests and ensure the house/gear render consistently on GitHub Pages.',
      sections: [
        {
          title: 'UI',
          items: [
            'Switched Home (house) icon to a local SVG asset.',
            'Switched Options (gear) icon to a local SVG asset.',
            'Kept dark/light theme visibility via CSS filtering.'
          ]
        }
      ]
    },
    {
      version: 'v1.8.1',
      date: '2025-12-20',
      time: '—',
      title: 'Changelog timeline + Home navigation + Archive modal fixes',
      summary: 'Reworked the changelog page into a compact version list with a “Read more” modal; added Home button with icon across pages; fixed menu hover and Archive delete modal reliability.',
      sections: [
        {
          title: 'Changelog',
          items: [
            'Navbar now matches the Index layout for consistent UX.',
            'Replaced long posts with a compact version list and “Read more” modal.',
            'Improved spacing so the page title is no longer flush to the left.'
          ]
        },
        {
          title: 'Navigation',
          items: [
            'Home button added (with house icon) to Editor, Archive, and Changelog.',
            'Changelog page now uses Home instead of Documents/Archive buttons.'
          ]
        },
        {
          title: 'Archive',
          items: [
            'Permanent delete uses a custom modal instead of browser prompts (and now reliably opens).'
          ]
        },
        {
          title: 'UI',
          items: [
            'Settings dropdown Changelog row now highlights as a full-width item on hover.'
          ]
        }
      ]
    },
    // Previous history (kept for continuity)
    {
      version: 'v1.7.0',
      date: '2025-12-20',
      time: '—',
      title: 'Archive confirmation modal + initial changelog page',
      summary: 'Replaced browser confirm prompts with a styled modal and introduced changelogs.html for tracking versions.',
      sections: [
        { title: 'Archive', items: ['Added a permanent delete confirmation modal.'] },
        { title: 'Changelog', items: ['Added changelogs.html and a link in Options menu.'] }
      ]
    },
    {
      version: 'v1.6.4',
      date: '2025-12-20',
      time: '—',
      title: 'Options button icon adjustments',
      summary: 'Options icon refinement and layout stabilization.',
      sections: [{ title: 'UI', items: ['Options icon/label stabilization.'] }]
    },
    {
      version: 'v1.6.3',
      date: '2025-12-20',
      time: '—',
      title: 'Quill toolbar icon sizing restoration',
      summary: 'Restored Quill toolbar icon sizing (alignment controls) and improved Options reliability.',
      sections: [{ title: 'Editor', items: ['Restored Quill toolbar icon sizing to prevent tiny/missing alignment icons.'] }]
    },
    {
      version: 'v1.6.1',
      date: '2025-12-20',
      time: '—',
      title: 'Header link styling fixes',
      summary: 'Removed unwanted underlines and cleaned up header button presentation.',
      sections: [{ title: 'Index', items: ['Removed underline styling from buttons/links in the header.'] }]
    },
    {
      version: 'v1.8.0',
      date: '2025-12-20',
      time: '—',
      title: 'Changelog UI and navigation improvements',
      summary: 'Introduced a compact version list with Read more modals, aligned navbar styling, and improved Archive interactions.',
      sections: [
        { title: 'Changelog', items: ['Switched to a version list layout with a Read more modal for details.','Adjusted header styling to match the Index page.'] },
        { title: 'Navigation', items: ['Added a Home button across key pages.'] },
        { title: 'Archive', items: ['Improved permanent-delete confirmation experience.'] }
      ]
    },
    {
      version: 'v1.6.2',
      date: '2025-12-20',
      time: '—',
      title: 'Options button icon reliability update',
      summary: 'Stabilized the Options trigger rendering across environments.',
      sections: [
        { title: 'UI', items: ['Improved Options trigger markup and styling.'] }
      ]
    },
    {
      version: 'v1.5.1',
      date: '2025-12-20',
      time: '—',
      title: 'Header markup bugfix',
      summary: 'Corrected invalid header markup that caused layout inconsistencies.',
      sections: [
        { title: 'Bugfix', items: ['Fixed malformed header/button HTML.'] }
      ]
    },
    {
      version: 'v1.5.0',
      date: '2025-12-20',
      time: '—',
      title: 'Archive UI and toast improvements',
      summary: 'Improved Archive styling and introduced timed notification toasts for destructive actions.',
      sections: [
        { title: 'UI', items: ['Added gradient styling for Archive actions.','Added toast notifications with a countdown timer.'] }
      ]
    },
{
  version: 'v1.9.13',
  date: '2025-12-21',
  time: '10:05 AM PST',
  title: 'Fix: Quill toolbar picker spacing and borders',
  summary: 'Removed unintended borders on Quill dropdown controls and improved spacing/padding so the toolbar matches the rest of the UI.',
  sections: [
    {
      title: 'Bugfix',
      items: [
        'Removed borders on Heading/Text Size/Alignment picker labels.',
        'Added consistent padding and chevron spacing so dropdown labels do not crowd text.',
        'Improved alignment dropdown icon sizing and centering.'
      ]
    }
  ]
},
];
