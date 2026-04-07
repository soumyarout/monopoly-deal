# Monopoly Deal — Multiplayer Card Game

A fully-featured, real-time multiplayer implementation of the **Monopoly Deal** card game. Play against friends online or against AI opponents in single-player mode.

---

## Features

### Game Modes
- **Single-player** — play instantly against 1–4 AI opponents; no room code needed
- **Multiplayer** — create a room, share the code, play with 2–5 people in real time

### Three Regional Editions
| Edition | Properties |
|---|---|
| **US** | Mediterranean Ave, Boardwalk, etc. |
| **UK** | Old Kent Road, Mayfair, etc. |
| **India** | Mumbai Central, Nariman Point, etc. |

### Full Monopoly Deal Rules
- Draw 2 cards per turn (or 5 after an empty-hand turn)
- Play up to 3 cards per turn: properties, cash, or action cards
- Discard to 7 at end of turn
- **Action cards**: Deal Breaker, Sly Deal, Forced Deal, Debt Collector, It's My Birthday, Pass Go, Just Say No, Double the Rent, House, Hotel
- **Rent cards**: color-specific (charge all opponents) and wild (charge one opponent)
- Any action/rent card can be banked as cash instead of played
- Wildcards can be moved between color groups freely on your turn
- Houses (+$3M) and Hotels (+$4M) attach to complete sets
- Win by collecting 3 complete property sets of different colors

### Payment System
- Interactive payment modal: select which bank cards and/or properties to surrender
- **Just Say No** can cancel any targeted action
- AI players pay automatically; human players choose what to give

### Per-Turn Timer
- Configurable at room creation: 30 s, 1 min, 1m 30s, 2 min, or no limit
- Countdown shows in the header only on your turn (red + pulse when ≤ 10 s)
- Server auto-draws and auto-discards on timeout; turn advances automatically

### Table UI
- Click any opponent to inspect their full property area and bank
- Click any property set to see the rent table with the current tier highlighted
- Tap a wildcard on your table to move it to another valid color group
- Deck and discard pile shown in the center

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v3, shadcn/ui |
| Backend | Express 5, Node.js |
| Real-time | Socket.IO v4 (WebSockets) |
| State | React hooks + Socket.IO events |

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Start both the backend server and Vite dev server
npm run dev
```

- Vite dev server: `http://localhost:5173`
- Backend API / WebSocket server: `http://localhost:3000`

### Production build

```bash
npm run build   # TypeScript compile + Vite build → dist/
npm start       # Serves frontend + WebSocket from port 3000
```

Or use the convenience script:

```bash
bash start-game.sh
```

Then open `http://localhost:3000`.

---

## Deployment

This app requires a **persistent Node.js process** (for Socket.IO). It **cannot** be deployed to Vercel or other serverless platforms.

### Recommended: Railway

1. Push to a GitHub repository
2. Create a new project on [railway.app](https://railway.app) → deploy from GitHub
3. Set start command to `npm start`
4. Railway provides a public `https://` URL with WebSocket support — no config changes needed

The server already reads `process.env.PORT` so Railway's automatic port injection works out of the box.

### Other options
- **Render** (free tier spins down after 15 min idle — not ideal for a game server)
- **Fly.io** — excellent WebSocket support, free tier available
- **Any VPS** — run `npm start` with `pm2` for process management

---

## Project Structure

```
├── server/
│   └── server.ts          # Express + Socket.IO: all game logic, room management
├── src/
│   ├── components/
│   │   ├── cards/
│   │   │   └── Card.tsx           # Card component (all types)
│   │   ├── game/
│   │   │   ├── GameTable.tsx      # Table view: opponents, properties, wildcard modal
│   │   │   ├── MainMenu.tsx       # Create / join room UI
│   │   │   ├── PaymentModal.tsx   # Payment selection UI
│   │   │   ├── PlayerHand.tsx     # Hand + card action modal
│   │   │   └── RoomLobby.tsx      # Pre-game lobby
│   │   └── ui/                    # shadcn/ui primitives
│   ├── data/
│   │   └── cards.ts       # Deck generator, card data (US / UK / India)
│   ├── hooks/
│   │   └── useSocket.ts   # All Socket.IO events + game actions
│   ├── types/
│   │   └── game.ts        # Shared TypeScript types (Card, Player, GameRoom, …)
│   └── App.tsx            # Root: routing between menu / lobby / game / end screen
├── rule_spec.md           # Full Monopoly Deal rules spec (reference)
└── package.json
```

---

## How to Play

1. **Create or join a room** — enter your name, pick a version and timer, share the room code
2. **Lobby** — mark yourself ready; host starts when everyone is set
3. **Your turn**:
   - Click **Draw Cards** to draw 2
   - Click a card in your hand to play it (or bank it as cash)
   - Click **End Turn** when done (or after playing 3 cards)
4. **When charged rent/debt** — a payment modal appears; select cards to pay
5. **Win** — be the first to collect 3 complete property sets

---

## License

For educational purposes. Monopoly Deal is a trademark of Hasbro, Inc.
