# Hustling Kingdom — world-first UI

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
`/account`, `/city` and `/hustle` are real, reloadable routes. City shows five locked
districts; Hustle explains the unavailable opportunity space. Neither exposes domain
actions. Rest is visibly locked. The live actions are Phone, Bank and appearance.
Login and character creation finish at Home. Auth and creation are separate entry
screens connected visually to Old Town.

## Phone and Bank

Phone is an in-game device, with a launcher, app tiles, close control and home bar.
Bank is its only active app. Messages, Jobs, Trading, Properties and Dating are
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

Phase 4 Jobs, travel, stat recovery, clock, social apps and Phaser remain unimplemented.
Future Phaser integration must sit behind the approved GameBridge rather than owning
Vue’s HUD, phone, panels or authoritative state.
