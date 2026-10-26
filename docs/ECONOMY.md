# HUSTLING KINGDOM — ECONOMY.md

**Version:** 1.0  
**Currency:** HK₦  
**Principle:** Money should be fun to earn but difficult enough to keep that wealth remains meaningful.

## Objective

The economy models earning → spending → risking → investing → losing → recovering → building wealth. Progression should be volatile rather than purely linear.

## Currency and Starting State

HK₦ is fictional in-game currency with no real-money redemption or promised monetary value. New characters begin with HK₦15,000 cash and HK₦5,000 bank balance, for HK₦20,000 liquid wealth. Starting balances must be represented by ledger entries.

## Accounts and Net Worth

Players have Cash, Bank, Assets and eventual explicit Liabilities. Liquid wealth = Cash + Bank. Net worth = Cash + Bank + property value + vehicle value + business value + investments − debt.

## Immutable Ledger

Every economic mutation creates a transaction containing player/wallet, type, direction, amount, balance before/after, reference, idempotency key, metadata and timestamp. Corrections use compensating transactions; historical transactions are never rewritten.

Initial transaction types include starting balance, salary, hustle reward/loss, business revenue/expense, trading profit/loss, property purchase/rent/sale, vehicle purchase/sale/repair, club/lifestyle/relationship/health/legal expenses, fines, seizures, rewards and audited admin adjustments.

## Wealth Tiers

Suggested net-worth tiers: Survivor <100k; Hustler 100k–1m; Rising 1m–10m; Baller 10m–50m; Big Boy/Girl 50m–250m; Boss 250m–1bn; Kingpin 1bn–10bn; Tycoon 10bn+.

## Jobs

Jobs provide predictable low-Heat income. Initial balancing examples range from cleaner/shop assistant/delivery work through skilled technology/business roles. Rewards are game-activity values rather than claims about real salaries. Final reward can use Base Salary × Skill Multiplier × Performance Multiplier, with low variance.

## Abstract Hustle Economy

Underground activities remain fictional abstractions. Each defines entry cost, reward range, success probability, energy/stress costs, Heat, reputation, cooldown and requirements. Suggested tiers range from small HK₦20k–100k opportunities to elite high-risk fictional contracts with much larger rewards and Heat. No real fraud workflow is modeled.

Failure may lose entry cost or additional virtual funds, reduce reputation, increase stress/Heat, or trigger fictional case events. Balance activities by expected value while treating Heat as a second cost/currency.

## Heat

Heat rises through risky fictional activities and decays over game time when players avoid them. Suggested base decay is configurable (for example two points per game day). Heat bands alter abstract event probability. Do not encode real investigative/evasion tactics.

## Trading

Trading uses fictional game-controlled instruments such as USD/HK₦, GBP/HK₦, EUR/HK₦ and fictional indices. Low, medium and high risk tiers expose players to increasingly wide game-return distributions. It is entertainment, not a brokerage or financial advice.

## Businesses

Businesses bridge hustling and ownership. Initial examples: food stand, barbershop, photography studio, fashion store, logistics company, restaurant, media company, nightclub, car dealership, technology company, real estate company and record label. Each has startup cost, base revenue, operating costs, skill/location/reputation modifiers and upgrades. Businesses can lose money.

## Property

Suggested progression: shared room, self contain, 1-bedroom, 2-bedroom, mainland apartment, island apartment, duplex, mansion and Royal Island mansion. Players may rent or buy selected properties. Values can appreciate/depreciate through fictional world events.

## Vehicles

Vehicle classes range from motorcycle and old sedan through luxury SUV, sports car, supercar and ultra-luxury. Vehicles depreciate and create maintenance/repair costs while increasing reputation.

## Nightlife and Lifestyle

Nightlife deliberately destroys currency in exchange for visibility/reputation. Lifestyle tiers create recurring expenses. This produces the core choice between flexing and investing.

## Relationships and Health

Relationships create optional dates, trips, gifts, celebrations and emergency-support costs while quality also depends on trust, compatibility, time and choices. Health events can create clinic/hospital expenses.

## Fictional Legal Consequences

Case events may create legal expenses, fines, freezes/seizures, business disruption and lost earning time. These are abstract game consequences, not representations of real enforcement procedures.

## Bankruptcy and Comeback

Bankruptcy never deletes the account. Players unable to meet recurring obligations may lose leases, vehicles or businesses, downgrade lifestyle and reputation, then regain access to basic jobs. Track highest net worth and recovery milestones for comeback achievements/leaderboards.

## Sources and Sinks

Sources: jobs, hustles, businesses, trading profits, property gains, achievements, events and tutorial rewards. Sinks: rent, properties, vehicles, repairs, business investment/upgrades, nightlife, lifestyle, relationships, health, trading losses, legal events, fees, cosmetics and travel/events.

Track total currency supply, currency created/destroyed per period, median cash/net worth, top 1% wealth, affordability and bankruptcy frequency to detect inflation.

## Configuration

Do not hard-code balance values throughout application logic. Jobs, hustles, vehicles, properties and businesses store configurable values. Global economy configuration is versioned and environment-aware. Admin tools eventually rebalance the game without code deployment.

## Randomness and Atomicity

Financial outcomes are server-generated behind a testable randomness service. Multi-effect actions commit atomically: a successful hustle's money, Heat, reputation and stress changes all commit together or not at all.

## Idempotency and Concurrency

Sensitive economic endpoints accept idempotency keys so retries cannot duplicate rewards. Simultaneous spend requests must use database transactions/locking/conditional updates so the same funds cannot be spent twice.

## Exploit Protection

The server validates prices, ownership, rewards, cooldowns, requirements, balances, energy, Heat, skills and inventory. The frontend sends intent, never authoritative prices/rewards. Monitor abnormal action frequency, progression and transaction velocity.

## Snapshots and Admin Dashboard

Periodic player economy snapshots record cash, bank, assets, debt, net worth, income, expenses, reputation and Heat. Admin dashboards show supply, creation/destruction, median/top wealth, profitable activities, sinks, bankruptcies and asset/business activity.

## Progression Target

Early game: survival/jobs/small hustles. Mid game: millions, first car/apartment/business. Upper mid game: tens of millions and lifestyle pressure. Late game: hundreds of millions and major assets. End game: billions, empire and influence. Exact pacing is determined through playtesting.

## Core Economic Tension

Players should repeatedly face a meaningful choice between visible consumption and productive ownership—for example, spending HK₦50m on a luxury SUV versus investing HK₦50m into a business. Fast money increases lifestyle pressure; sustainable ownership creates long-term freedom.
