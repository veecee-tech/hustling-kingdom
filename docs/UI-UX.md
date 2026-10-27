# Hustling Kingdom — world-first UI

## Phase 5 progression experience

Me now includes a compact six-skill roster, semantic XP meters, level text and
contextual skill detail with work sources and next known opportunity. Trading and
Street explicitly have no active XP source. Jobs show authoritative required/current
levels. Completion announces XP, level-up and real newly opened job gates. Full skill
state remains out of the HUD; no training button, audio, Rest or game clock is added.
The later historical descriptions of Skills as deferred are superseded by this slice.
World → HUD → contextual panels and all ALPHA art labels remain unchanged.

## Art approval status

WORLD-FIRST UI ARCHITECTURE: APPROVED

CURRENT SVG WORLD ART: ALPHA / TEMPORARY

CURRENT CHARACTER ART: ALPHA / TEMPORARY

CURRENT LOCATION ART: ALPHA / TEMPORARY

FINAL ART DIRECTION: NOT YET APPROVED

## Product structure

The world is the primary interface. Phase 3.1 replaces the rejected header / hero /
stacked dashboard / floating navigation with **World → HUD → contextual panels**.
Home is the character’s current location, Family House in Old Town. There are no
transaction cards or long content columns on Home.

The public Lagos Life experience was studied for product principles: visible place,
restrained chrome, spatial character identity and contextual interactions. All artwork,
SVG paths, colors and composition here are original. No external artwork, fonts,
icon libraries or new runtime dependencies were added.

## World and application boundary

`AppLayout` composes `WorldView`, `PlayerHud`, `BottomNav` and route-driven
`ContextPanel`. The original static SVG courtyard remains visible behind every game
panel. `CharacterAvatar` renders the existing server appearance catalog: skin tone,
face, hair, top, bottom and shoes. It is reused in the world, HUD, Me, creation and
visual choice controls. The world has no movement, travel, clock, presence or Phaser
implementation. A scene theme attribute provides an atmosphere seam, not a game clock.

Only the server owns character and wallet state. Auth owns the current character;
the wallet store owns authoritative wallet/history data and clears it on identity
changes. Neither the scene nor its interactions calculate outcomes or mutate stats.

## Game frame and navigation

Desktop uses a wide bounded game frame, with HUD at the top, an anchored full-width
dock at the bottom, and contextual sheets on the right. The world occupies the frame;
it is not an illustration inside a marketing hero. Mobile uses the dynamic viewport,
safe-area padding, compact HUD, persistent dock and sheets with their own scrolling.
Home does not scroll. Forms and history scroll inside their panel.

Home, Hustle, City, Phone and Me are the five dock destinations. `/phone`, `/wallet`,
`/account`, `/city`, `/hustle`, `/jobs`, `/jobs/:jobId` and `/jobs/work` are real,
reloadable routes. City shows five locked districts. Hustle now opens Work / Jobs;
street hustles and businesses remain locked. Rest recovery remains unavailable.
Jobs, Phone, Bank and appearance are live actions.
Login and character creation finish at Home. Auth and creation are separate entry
screens connected visually to Old Town.

## Phone and Bank

Phone is an in-game device, with a launcher, app tiles, close control and home bar.
Bank and Jobs are active apps. Messages, Trading, Properties and Dating remain
explicitly locked. Bank retains precise cash/bank/total amounts, deposit, withdraw,
immutable history and pagination. It uses the existing typed API client and the
unchanged economy API. The HUD uses full BigInt-safe money formatting too; long
values wrap rather than lose precision. There is no invented loading balance.

Transfers preserve the established stable retry keys, authoritative reloads, version
checks and account-change response protection. Confirmed transfers announce the
amount and destination, for example “HK₦5,000 moved to Bank.” No optimistic balance
is invented. Refresh failures remain visible and retryable.

## Identity and style

Me leads with the character, full appearance preview, health/energy/stress meters,
reputation, Heat and visual wardrobe controls. Account/security controls are subordinate.
Creation shows a prominent avatar beside the desktop controls and above them on mobile.
Appearance choices are native labeled radio groups with miniature avatar previews;
keyboard arrows and Space work without custom selection logic. Saving retains the
existing changed-fields-only patch behavior and server validation.

## Visual identity

Old Town uses warm ochre walls, terracotta roofs, dusty streets, palms, sage foliage
and a light blue-green sky. Cream game controls and deep green framing contrast with
the environment. Amber is reserved for available actions. Original SVG line icons
cover navigation, money, energy, Heat and reputation. Typography uses local Trebuchet
MS / Segoe UI / sans-serif without font downloads. The city name is Kingdom City.

## Accessibility and feedback

Native modal dialogs supply focus containment and Escape behavior. Close returns to
Home, and connected initiating controls recover focus. Direct panel URLs also close
safely to Home. The Bank back arrow and device home bar return to the launcher.
Each dialog has a clear accessible name and an always-visible close control. The
background remains visible but is inert while a modal is open.

Keep semantic headings, labeled meters, textual values, status/alert feedback, native
radio semantics, visible keyboard focus and a skip link. Primary controls are at least
46px high. Disabled future actions remain labeled. Short panel-entry and button-press
motion respects reduced-motion preferences. Bank balances do not animate fabricated
intermediate values. Connection diagnostics live in a small disclosure rather than
dominating the world.

## Verification and future boundary

Browser tests cover mobile and desktop login → world/avatar/HUD → Phone → Bank →
deposit → world → reload persistence, withdraw, panel navigation, style saving,
locked destinations, keyboard focus, reduced motion and viewport containment.
Screenshots cover Home, Phone, Bank, Me and character creation. Existing authentication,
character and economy tests remain regression gates. Screenshots are review artifacts,
not committed assets.

Jobs are implemented in Phase 4. Skills, underground hustles, travel, production
stat recovery, game clock, social apps and Phaser remain unimplemented.
Future Phaser integration must sit behind the approved GameBridge rather than owning
Vue’s HUD, phone, panels or authoritative state.

## Phase 4 work experience

Hustle opens a game opportunity panel with a live Work entry. Jobs are a contextual
city noticeboard, not a CRUD table. Each posting gives its fictional employer,
location, pay, Energy cost, timing and availability. Details use a concise shift
brief; a running shift shows the character, server-derived progress and completion
action. The underlying world, HUD and dock remain visible.

A first-move prompt at Family House directs unworked characters to Jobs. During a
shift it becomes a resume prompt. Once a real completed assignment exists, the
first-job prompt disappears; no local-storage tutorial flag invents progression.
Completion announces salary and Energy spent, then offers another shift or Phone.
Bank history labels real JOB_SALARY entries “Job salary.”

The jobs store owns catalog/assignment state only. Character stats remain in auth
state and balances/history remain in the wallet store. Completion receipts may be
historical, so the frontend reloads current `/dashboard`, catalog and wallet/history
rather than overwriting current stats with an old retry receipt. Identity epochs
and read generations discard stale responses. Window focus refreshes work state;
there is no realtime sync platform. Browser timers display progress only.
