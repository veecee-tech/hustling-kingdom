# HUSTLING KINGDOM — V1 GAME DESIGN DOCUMENT

**Version:** 1.0  
**Platform:** Mobile-first web application  
**Genre:** Multiplayer Nigerian life / hustle / economic simulation  
**Setting:** Kingdom City, a fictional contemporary Nigerian metropolis  
**Tagline:** **Hustle. Flex. Build. Survive.**

## Vision

Hustling Kingdom is a Nigerian multiplayer life-simulation game about money, ambition, status, relationships, risk, lifestyle inflation, entrepreneurship and consequences. A new player starts with HK₦20,000, a basic phone, basic clothes, no vehicle, no property, no business, no reputation and no connections. The goal is not merely to make money, but to turn hustle into a sustainable kingdom before lifestyle, bad decisions, financial losses or fictional law-enforcement consequences destroy the player's progress.

Crime-related gameplay is fictional and abstract. The game may use culturally recognizable fictional labels such as “cashout” or “underground contract,” but it does not simulate phishing, credential theft, victim selection, stolen accounts, payment routing, benefit fraud procedures, money laundering, mule/picker recruitment, or real criminal marketplaces.

## Design Pillars

1. **Money** — players constantly decide how to earn, spend, save and invest.
2. **Status** — cars, houses, businesses, fashion and nightlife make wealth socially visible.
3. **Risk** — faster rewards generally carry greater volatility or Heat.
4. **Nigerian culture** — language, humor, social pressure, nightlife, ambition and everyday economic life should feel locally recognizable.
5. **Stories** — the system should naturally create shareable rise, fall and comeback stories.

## Kingdom City

V1 uses a fictional city rather than reproducing Lagos exactly. District progression includes Old Town, Mainland, City Centre, The Island and Royal Island. Locations include homes, markets, offices, banks, clubs, restaurants, dealerships, gyms, hospitals, businesses and public spaces.

## Character Creation

Players choose name, username, gender presentation and lightweight visual customization such as skin tone, face, hair, clothing, shoes and accessories. Target creation time is under 60 seconds.

Starting state:

- Cash: HK₦15,000
- Bank: HK₦5,000
- Reputation: 0
- Heat: 0
- Health: 100
- Energy: 100
- Stress: 10
- Residence: Family House
- Vehicle: None
- Job: Unemployed
- Business: None

## Core Stats

The main V1 stats are Cash, Bank, Reputation, Heat, Health, Energy and Stress. Money is virtual game currency only and cannot be withdrawn or exchanged for real money.

## Reputation

Reputation represents social status. It grows through cars, properties, businesses, fashion, nightlife, achievements, events and selected activities. Reputation unlocks opportunities and locations. Example social tiers: Unknown, Upcoming, Hustler, Baller, Big Boy/Big Girl and Elite.

## Heat

Heat is an abstract risk meter for fictional underground activity. Suggested bands are 0–20 Low, 21–40 Watched, 41–60 Person of Interest, 61–80 Investigation, 81–99 Critical and 100 Case Event. Heat affects game-event probability but does not reproduce real investigative methods or evasion tactics.

## Core Loop

Player → find work/hustle → make money → save/flex/invest → acquire assets/status/income → unlock opportunities → take more risk → succeed or fail → recover/progress → repeat.

## Career Paths

Players are never forced into underground gameplay.

**Legitimate:** delivery, sales, development, design, content creation, photography, barbering, mechanics, real estate and business ownership.

**Speculative:** fictional forex/trading simulation, business investments and property speculation.

**Underground:** abstract fictional contracts with server-calculated entry cost, reward range, success probability, energy cost, Heat and reputation changes. They never expose real fraud procedures.

## Hustle Outcomes

Possible outcomes: Big Win, Success, Partial Success, Failure and Disaster. Each hustle is configured with probability, reward range, energy/stress cost, Heat, reputation, cooldown and requirements. All outcomes are calculated server-side.

## Jobs and Skills

Jobs provide safer, predictable income. Skills include Business, Technology, Trading, Social, Fitness and Street. Skills unlock higher-paying jobs and modify selected game calculations.

## Trading

Trading is a fictional simulation with game-controlled instruments and prices. Players choose an instrument, amount, risk tier/direction and duration. The system is entertainment, not financial advice or a brokerage.

## Businesses

Businesses transition players from hustling to ownership. V1 examples include barbershop, restaurant, fashion store, logistics company, nightclub, car dealership, real estate company, technology company, media company and record label. Businesses have startup costs, operating expenses, revenue, levels, location and reputation effects.

## Property and Vehicles

Housing progresses from family/shared accommodation through apartments, duplexes and mansions. Property affects reputation, recovery and storage and may later generate rental income. Vehicle classes progress from motorcycles and old sedans to luxury vehicles and supercars. Vehicles have purchase prices, reputation value, depreciation and maintenance costs.

## Lifestyle Inflation

As status grows, recurring expenses rise. Rent, vehicle maintenance, nightlife, relationships and business costs ensure that a one-time windfall does not automatically create permanent wealth.

## Nightlife

Clubs are social money sinks where players can enter events, buy virtual drinks/tables, meet NPCs, see other players and gain social visibility. Spending raises status but does not create productive assets.

## Relationships

NPC relationships use Attraction, Trust, Loyalty, Compatibility and Lifestyle Expectation. Choices, time and behavior matter; affection is not simply purchased. Relationship mechanics apply across playable genders.

## Health, Energy and Stress

Actions consume energy and may change stress/health. Sleep, rest, gym, entertainment, social activity and wellness restore or modify stats. This prevents unlimited action spamming.

## Fictional Law-Enforcement and Prison

A fictional Financial Crimes Bureau or similar agency may trigger investigations, asset reviews, cases, fines, seizures or prison events based on Heat. Prison is not necessarily game over: players can study, exercise, work, network, appeal through abstract game choices or serve time. No real investigative/evasion procedures are simulated.

## Random World Events

Fuel scarcity, rent increases, economic booms, market crashes, heavy rainfall, concerts, festive seasons, recessions, technology booms and property booms can temporarily modify economic parameters.

## Multiplayer and Social

V1 supports public profiles, follows, selected asset visibility, location presence and leaderboards. Deep player-to-player trading, gangs/clans and voice chat are out of scope for V1.

## Leaderboards and Achievements

Leaderboards include Richest, Reputation, Business Empire, Property, Trading, Influence and Fastest Rising. Achievements include First Million, First Car, First House, First Business, major net-worth milestones, surviving a case event, losing everything and comeback milestones.

## Advertising

Real advertisers may buy approved placements such as virtual billboards, clubs and phone-feed inventory. Eligible categories include legitimate fintech, fashion, phones, restaurants, music, events, cars, real estate, education, technology, entertainment and regulated financial services. Real fraud facilitators, stolen-account services, laundering services and real criminal picker networks are prohibited. Fictional underground businesses may exist only inside the game universe.

## Monetization

Potential revenue includes real-world advertising, sponsored virtual locations, cosmetics, character customization, premium visual themes and optional membership. Avoid direct pay-to-win currency sales that destroy economic credibility.

## Economy and Time

All money changes go through an immutable ledger. The server owns balances and outcomes. Game time is accelerated and configurable; jobs, rent, business payouts and events depend on the game clock.

## Main Navigation

Mobile-first navigation: **Home, Hustle, City, Phone, Me**. The Phone acts as a secondary operating system with Messages, Bank, Trading, Property, Motors, Jobs, Dating, Music, Social, Marketplace and News.

## News and Notifications

A fictional news feed surfaces player achievements and world events. Notifications cover salary, relationships, repairs, Heat, rent, investments, business revenue and leaderboard changes.

## World and Art Direction

Use a lightweight stylized 2D/isometric world rendered with Phaser or PixiJS while Vue handles application UI. Art direction is bright, humorous, Afro-urban, contemporary and slightly exaggerated, drawing from Nigerian street culture, nightlife, fashion, entrepreneurship and Afrobeats aesthetics without copying protected game/brand assets.

## Tone

Funny, chaotic, aspirational, satirical and occasionally painful. The game portrays consequences rather than functioning as a fraud tutorial.

## Viral Sharing

Major achievements, losses, arrests, comebacks and net-worth milestones should generate shareable cards designed for WhatsApp, X, Instagram and TikTok.

## V1 Scope

Authentication; character creation; dashboard; wallet and ledger; game clock; energy/health/stress; skills; jobs; abstract hustles; fictional trading; reputation; Heat; fictional law-enforcement events; properties; vehicles; businesses; relationships; nightlife; inventory; random events; player profiles; basic presence; leaderboards; achievements; notifications; city/map; advertising framework; admin dashboard.

## Explicitly Not V1

Native mobile apps; voice chat; combat; open-world driving; player-created maps; crypto/NFTs; currency withdrawals; real-money gambling; real-money player marketplace; real criminal marketplace; operational fraud mechanics; AI NPC conversations; full player-to-player trading; complex gangs/clans; hundreds of locations.

## Administration and Analytics

Admins eventually configure jobs, hustles, items, vehicles, properties, businesses, events, NPCs, rewards, economy parameters and ads without code deployment. Track registration, character creation, jobs, hustles, purchases, businesses, Heat/cases, bankruptcy, ads and sharing. Primary success metrics include character-creation conversion, tutorial completion, D1/D7 retention, sessions, activity frequency, money created/destroyed, business ownership and sharing.

## Progression and Endgame

Progression moves through Survival → Hustling → Flexing → Ownership → Empire → Kingdom. There is no conventional ending; sustainable wealth, influence and low-risk income become endgame status.

## Opening Experience

Register → create character → receive HK₦20,000 → tutorial message asks “You wan work or you wan hustle?” → complete first activity → earn money → receive an upcoming expense notification → understand the core pressure to earn more.

## Technical Principle

The client requests actions; the server determines outcomes. Vue 3/TypeScript/Vite/Pinia handle UI, Phaser handles the world, NestJS handles authoritative game logic, PostgreSQL stores durable truth, Redis supports cache/presence/queues, Socket.IO handles realtime, and BullMQ handles background work. Start as a modular monolith.
