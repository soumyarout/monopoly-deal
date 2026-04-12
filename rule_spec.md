

Here’s a ready-to-use `MONOPOLY_DEAL_SPEC.md` you can drop into a repo so Claude has a full game spec for implementation.

***

```markdown
# Monopoly Deal – Game Design & Rules Spec

Version: 1.0  
Target: Digital implementation of Hasbro’s **Monopoly Deal** card game for 2–5 players.[web:9][web:19]

---

## 1. High-level Overview

- Player count: 2–5.[web:9]
- Goal: Be the first player to complete **3 full property sets** of different colors on the table.[web:9]
- Core loop:  
  - Start of turn → draw 2 cards.  
  - Main phase → play up to 3 cards (bank, property, action).[web:9]  
  - End of turn → discard down to 7 cards in hand (if needed).[web:18]

There is no elimination; players can be temporarily “broke” (no cards in front of them) but remain in the game.[web:18]

---

## 2. Deck Composition

Total cards: **110** (standard English deck).[web:9][web:19]

Breakdown (practical implementation numbers):

- 4 Quick Start / Rules cards (can be ignored in digital implementation UI-only).[web:9]
- 28 Property cards.[web:9][web:19]
- 11 Property Wildcards.[web:9][web:12][web:17]
- 13 Rent cards.[web:9][web:12][web:17]
- 20 Money cards.[web:9][web:19]
- 34 Action cards (some double as money; counts overlap with Rent/House/Hotel/Pass Go etc.).[web:9][web:19]

### 2.1 Money Cards

Money cards live only in the **Bank** and are used to pay debts.[web:9][web:18]

- Values and counts (standard): 1M, 2M, 3M, 4M, 5M, 10M.[web:9][web:19]

Implementation detail: many Action cards have a printed bank value and can be treated as money if banked instead of played.[web:8][web:9]

---

## 3. Property System

### 3.1 Property Sets

Each color set has:

- A required number of cards to be a **full set** (e.g., some sets require 2, others 3).[web:9]
- A rent scale based on how many cards of that color you own (1, 2, or full set). Digital UI should display this clearly.[web:9][web:8]

A **full set** is important because:

- It counts toward the win condition (3 full sets of different colors).[web:9]
- It can be enhanced by House/Hotel cards (for applicable colors).[web:9][web:8]

### 3.2 Property Wildcards

Property wildcards can serve as one of multiple colors.[web:12][web:17]

Types (by color pairings vary slightly by edition, but typical deck has):[web:12][web:17]

- 8 two-color wildcards (e.g., Purple/Orange, Brown/Light Blue, Railroad/Utility, Green/Dark Blue, Red/Yellow, etc.).[web:12][web:17]
- 2 multi-color wildcards that can act as **any color**.[web:12][web:17]

Rules:

- A wildcard belongs to **exactly one** color at a time and can be moved/re-assigned on the owner’s turn.[web:1][web:8]
- Wildcards can help complete sets; they behave like normal property once assigned.[web:1][web:8]

Implementation hint:

- Represent wildcards as an object with a list of allowed colors and a current chosen color.

---

## 4. Zones / Layout Model

Each player has 3 logical zones:[web:9][web:18]

1. **Hand**  
   - Hidden from opponents.  
   - Unlimited size during the turn, but must be reduced to 7 at end of turn.[web:18]

2. **Bank**  
   - Face-up money cards + any action cards banked as money.  
   - Used to pay rent and action-related demands.[web:9][web:18]

3. **Property Area**  
   - Face-up property and wildcard cards, grouped by color/set.  
   - Also holds Houses and Hotels attached to sets.[web:9][web:8]

Global zone:

4. **Center / Discard Pile**  
   - All played action cards (including Rent, Pass Go, etc.) go here after resolving.[web:9]

---

## 5. Turn Structure

### 5.1 Setup

- Remove Quick Start cards.[web:9]
- Shuffle all remaining cards into a single deck.[web:9]
- Deal **5** cards to each player (starting hand).[web:9][web:19]
- Place deck face-down as **draw pile**; discard pile starts empty.[web:9]

### 5.2 Start of Turn

- Active player draws **2** cards from the draw pile.  
- Exception: if a player has **0 cards in hand at the end of their previous turn**, they instead draw **5** at the start of their next turn.[web:9][web:18]

### 5.3 Main Phase

The active player may **play up to 3 cards** in any combination of:[web:9][web:18]

1. **Bank a card**  
   - Place a Money card or any Action card face-up in the Bank.  
   - Once banked, that card is **only money** and cannot be used for its action later.[web:9][web:18]

2. **Play a Property / Wildcard**  
   - Place property card into Property Area, grouped by color/set.  
   - May rearrange own properties/wildcards freely on their turn (does not count as plays).[web:9][web:18]

3. **Play an Action card**  
   - Place Action card into center, resolve effect, then send to discard.[web:9][web:18]
   - Some actions target a single player, others all opponents.

Each card placed into Bank, Property Area, or center as an action **consumes one of the 3 plays**.[web:9][web:18]

### 5.4 End of Turn

- If the player has more than **7 cards in hand**, discard down to 7 (player’s choice which to discard). Discarded cards go to center pile.[web:18]
- Check win condition (if any player now has 3 full sets).[web:9]

---

## 6. Payments & Debt Resolution

Players must pay when:[web:9][web:18][web:19]

- Hit by a Rent card.
- Targeted by Debt Collector.
- Targeted by It’s My Birthday.
- A card effect demands payment.

Payment sources (in order of **player’s choice**, not creditor’s):[web:18]

1. Bank (money + banked actions).
2. Property sets / individual properties (including wildcards & set enhancements).[web:18]

Rules:

- You **never** pay from your hand.[web:18]
- You **do not get change**. If you owe 2M and only have a 3M card available, you must pay 3M.[web:18]
- If you cannot fully pay, you pay as much as possible; if you have nothing on the table, you pay nothing.[web:18]
- Paid property cards go into the **creditor’s Property Area**; paid money goes into creditor’s Bank.[web:18]

Implementation note:

- The paying player chooses which exact cards to surrender (respecting that properties must go to creditor’s property area and money to bank).

---

## 7. Win Condition

- A player immediately wins when they have **3 complete property sets** of **different colors** in their Property Area.[web:9]
- Full sets enhanced with Houses/Hotels still count as a single set.[web:9][web:8]

Implementation:

- Trigger a win check at the end of each action that modifies property sets, not just at end of turn.

---

## 8. Card Catalogue & Effects

### 8.1 Core Action Cards (Non-Rent)

All of these can be banked as money instead of played.[web:9][web:8][web:19]

1. **Deal Breaker**  
   - Count: 2.[web:9][web:19]  
   - Bank value: 5M.[web:9][web:8]  
   - Effect: Steal an **entire complete set** (including attached House/Hotel) from any one player and add it to your Property Area.[web:9][web:8]  
   - Cannot target incomplete sets.

2. **Sly Deal**  
   - Count: 3.[web:9][web:19]  
   - Bank value: 3M.[web:9][web:8]  
   - Effect: Steal **one property or wildcard** from another player’s Property Area (not from a full set).[web:9][web:8]  
   - You choose which card; target player has no choice except “Just Say No”.

3. **Forced Deal**  
   - Count:And 4 (in some printings 3; choose canonical for your build, spec uses 4 as per many rule summaries).[web:9][web:19]  
   - Bank value: 3M.[web:9][web:8]  
   - Effect: Swap one of your properties with one property from another player (again, not from a complete set).[web:9][web:8]

4. **Debt Collector**  
   - Count: 3.[web:9][web:19]  
   - Bank value: 3M.[web:8][web:19]  
   - Effect: Choose one player; they must pay you **5M** from their Bank/Property Area.[web:8]

5. **It’s My Birthday**  
   - Count: 3.[web:9][web:19]  
   - Bank value: 2M.[web:17][web:19]  
   - Effect: **All other players** pay you **2M** each.[web:17]

6. **Pass Go**  
   - Count: 10.[web:9][web:19]  
   - Bank value: 1M.[web:17][web:19]  
   - Effect: Draw **2 extra cards** from the draw pile immediately.[web:17]

7. **Just Say No**  
   - Count: 3.[web:9][web:19]  
   - Bank value: 4M.[web:8][web:17]  
   - Effect: Cancel an action card played **against you** (including Deal Breaker, Forced Deal, Sly Deal, Debt Collector, global rent, etc.).[web:8][web:17]  
   - Can be chained: a Just Say No can cancel another Just Say No.[web:8]

   Implementation detail:  
   - Does **not** count as one of your 3 plays; can be used out-of-turn as a reaction.[web:8]

8. **Double the Rent**  
   - Count: 2.[web:9][web:19]  
   - Bank value: 1M (varies slightly by printing; treat as 1M).[web:19][web:8]  
   - Effect: Play alongside a Rent card you are using to **double** that Rent’s total.[web:9][web:8]  
   - Double the Rent itself consumes **one of your 3 plays**; Rent is another play.[web:9]

### 8.2 House and Hotel Cards

These are property enhancements:[web:9][web:19][web:8]

1. **House**  
   - Count: 3.[web:9][web:19]  
   - Bank value: 3M.[web:8]  
   - Effect: Attach to a **complete property set** (not railroads/utilities in some rulesets) to increase rent by +3M when charging rent with that set.[web:9][web:8]

2. **Hotel**  
   - Count: 2.[web:9][web:19]  
   - Bank value: 4M.[web:8]  
   - Effect: Attach to a set that already has a House to further increase rent by +4M.[web:9][web:8]

Constraints:

- One House and one Hotel max per set (no stacking multiples of each).[web:9][web:8]
- Must be attached to a **complete set** and typically not to Railroads/Utilities.[web:9][web:8]

### 8.3 Rent Cards

Rent cards are technically Action cards but with a dedicated effect:[web:9][web:12][web:17][web:8]

- Total Rent cards: 13.[web:12][web:19]

Types:

1. **Two-color Rent Cards**  
   - Linked to 2 specific colors (e.g., Brown/Light Blue, Red/Yellow, Green/Dark Blue, Railroad/Utility, Purple/Orange).[web:12][web:17]  
   - Effect:  
     - Choose one of the two colors on the card for which you own at least one property.  
     - Charge **all other players** rent based on that chosen set’s rent value.[web:8]

2. **Wild Rent Cards (Any Color Rent)**  
   - Typically 3 “any color” Rent cards.[web:12][web:19]  
   - Effect:  
     - Choose any one property color on the table you own (any set).  
     - Charge **one player of your choice** rent for that set.[web:8]

Rent calculation:

- Rent owed = base rent from the chosen set (depends on how many properties you have in that set) + House/Hotel bonuses.[web:9][web:8]
- Can be doubled with **Double the Rent**.[web:9][web:8]

Implementation note:

- Rent targets:
  - Two-color Rent: all opponents.
  - Wild Rent: single opponent.

---

## 9. Important Edge Cases & Clarifications

These are the spots that often cause rule disputes and should be encoded explicitly:[web:9][web:18][web:8]

1. **Cannot steal from full sets with Sly/Forced Deal**  
   - Sly Deal and Forced Deal cannot target properties within a **complete set** (including attached upgrades).[web:9][web:8]

2. **Deal Breaker can steal full set including upgrades**  
   - All properties plus House/Hotel move to the new owner.[web:8]

3. **Re-arranging sets**  
   - You may freely reorganize your property sets and wildcards **only during your own turn** and it does not count as a play.[web:9][web:18]

4. **Paying with properties**  
   - If you use properties to pay, they move into the creditor’s Property Area exactly as-is (including attached House/Hotel).[web:18]

5. **Cannot move properties into Bank**  
   - You are not allowed to move properties into Bank to “protect” them or dodge payment.[web:18]

6. **Running out of draw pile**  
   - When draw pile empties, shuffle discard pile (excluding currently active card) to create a new draw pile.[web:18]

7. **Just Say No**  
   - Can cancel global actions just for you (e.g., global Rent or It’s My Birthday), leaving other players still affected.[web:8]

---

## 10. Data Model Suggestions (for Implementation)

This is a suggested conceptual model for a digital app (not rules, just structure):

### 10.1 Core Entities

- `Game`  
  - players: list of `Player`  
  - deck: `Deck`  
  - discard_pile: list of `Card`  
  - current_player_index  
  - phase (draw, main, end)  

- `Player`  
  - id, name  
  - hand: list of `Card`  
  - bank: list of `Card`  
  - properties: list of `PropertySet`  

- `PropertySet`  
  - color  
  - cards: list of `PropertyOrWildcardCard`  
  - house: optional `HouseCard`  
  - hotel: optional `HotelCard`  

- `Card` (base)  
  - id  
  - type: enum {Money, Property, WildProperty, Rent, Action, House, Hotel, Rule}  
  - name  
  - bank_value (nullable for pure properties)  

- `ActionEffect`  
  - execute(game, source_player, targets, context)  

### 10.2 Turn Engine

- `start_turn(player)`  
  - draw 2 or 5.  
- `play_card(player, card, target)`  
  - validate available plays, zone, card type.  
- `resolve_action(card, context)`  
  - apply effect, handle reactions (Just Say No).  
- `pay_debt(from_player, to_player, amount, debt_source)`  
  - prompt selection of cards to surrender.

---

## 11. UX Considerations

- Always display:
  - Each player’s number of full sets and total sets.  
  - Clear rent breakdown when playing Rent cards.  
  - Clear log of actions and payments.

- Reaction UI:
  - Whenever a player is targeted by an action that can be cancelled, prompt them for **Just Say No** if available.

---

This spec should give Claude everything needed to:

- Define the data structures.
- Implement the full rules engine.
- Handle edge cases identical to physical Monopoly Deal.
- Design a UI that maps cleanly to the physical game flow.
```

<span style="display:none">[^1][^10][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://monopolydealrules.com/index.php?page=cards

[^2]: https://www.buffalolib.org/sites/default/files/gaming-unplugged/inst/Monopoly Deal Card Game Instructions.pdf

[^3]: https://board-games.fandom.com/wiki/Monopoly_Deal

[^4]: https://www.scribd.com/document/953692839/Monopoly-Deal-Pastel-Deck

[^5]: https://monopolydealrules.com/index.php?page=general

[^6]: http://reglur.spilavinir.is/monopoly-deal-rules-en.pdf

[^7]: https://monopoly.fandom.com/wiki/Monopoly_Deal

[^8]: https://monopolydeal.net/keywords-images/

[^9]: https://fgbradleys.com/wp-content/uploads/rules/Monopoly Deal Rules.pdf

[^10]: https://www.wikihow.com/Play-Monopoly-Deal

