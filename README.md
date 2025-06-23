# 🧱 BitMemes - Bitcoin Meme Coin Inscription Launchpad

> A complete end-to-end Bitcoin meme-coin inscription launchpad that allows users to submit and vote on meme proposals, automatically inscribing winners to the Bitcoin blockchain via Ordinals.

## 🚀 Features

- **🎭 Meme Proposal System**: Users can submit meme coin proposals with metadata
- **🗳️ Voting Mechanism**: Community voting with wallet-based authentication
- **🏆 Leaderboard**: Real-time ranking of proposals by votes
- **⛓️ Bitcoin Integration**: Live block monitoring via Esplora API
- **📝 Automatic Inscriptions**: Winners get inscribed to Bitcoin blockchain
- **🎯 Multiple Inscription Methods**: Support for UniSat API, OrdinalsBot API, and Ord CLI
- **📊 Real-time Updates**: Live block counter and proposal updates
- **🔐 Wallet Integration**: Bitcoin wallet address-based user system

## 🏗️ Architecture Overview

### Frontend (React + Next.js)

- **Modern UI**: Built with Tailwind CSS and Framer Motion
- **Real-time Updates**: Automatic refresh of leaderboard and block data
- **Responsive Design**: Mobile-first approach with beautiful animations
- **Component-based**: Modular components for proposals, voting, and modals

### Backend (Next.js API Routes)

- **RESTful APIs**: Clean API design for proposals, voting, and system status
- **Database Layer**: PostgreSQL with Drizzle ORM
- **Bitcoin Integration**: Esplora API for blockchain data
- **Inscription Engine**: Automated cron job for inscription processing

### Inscription System

- **Block Monitoring**: Continuous monitoring of new Bitcoin blocks
- **Winner Selection**: Automatic selection of top-voted proposals
- **Multiple Methods**: UniSat API (primary), OrdinalsBot API, or Ord CLI for inscriptions
- **Order Tracking**: Real-time monitoring of UniSat inscription orders
- **Error Handling**: Robust error handling and retry mechanisms

## 📋 Prerequisites

- **Node.js** 18+ and pnpm
- **PostgreSQL** database
- **Bitcoin Setup** (choose one or more):
  - [UniSat API key](https://open-api.unisat.io/) (recommended for inscriptions)
  - [OrdinalsBot API key](https://ordinalsbot.com/) (alternative for inscriptions)
  - [Ord CLI](https://github.com/ordinals/ord) installed (for direct inscriptions)

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd bitmemes
pnpm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp env.example .env
```

Configure your `.env` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/bitmemes"

# Bitcoin Configuration
BITCOIN_NETWORK="testnet"
ESPLORA_API_URL="https://blockstream.info/testnet/api"

# Inscription Configuration
INSCRIPTION_FEE_RATE="15"
UNISAT_API="your-unisat-api-key"  # Recommended
UNISAT_RECEIVE_ADDRESS="your-bitcoin-address"  # For UniSat inscriptions
ORDINALSBOT_API_KEY="your-api-key"  # Alternative
ORDINALS_WALLET_PATH="/path/to/ord/wallet"  # Alternative

# Security
CRON_SECRET="your-secret-key"

# Client-side
NEXT_PUBLIC_BITCOIN_NETWORK="testnet"
NEXT_PUBLIC_ESPLORA_API_URL="https://blockstream.info/testnet/api"
```

### 3. Database Setup

```bash
# Generate migration
pnpm db:generate

# Apply migration
pnpm db:migrate

# (Optional) Open database studio
pnpm db:studio
```

### 4. Development

```bash
# Start development server
pnpm dev

# In another terminal, start inscription engine
pnpm inscription-engine
```

The app will be available at `http://localhost:3000`

## 🔧 Configuration Options

### Bitcoin Network

Switch between mainnet and testnet by updating:

```env
BITCOIN_NETWORK="mainnet"  # or "testnet"
ESPLORA_API_URL="https://blockstream.info/api"  # mainnet URL
```

### Inscription Methods

**Option 1: UniSat API (Recommended)**

```env
UNISAT_API="your-unisat-api-key"
UNISAT_RECEIVE_ADDRESS="your-bitcoin-address"
```

**Option 2: OrdinalsBot API**

```env
ORDINALSBOT_API_KEY="your-api-key"
```

**Option 3: Ord CLI**

```env
ORDINALS_WALLET_PATH="/path/to/your/ord/wallet"
```

**Option 4: Multiple Methods (Recommended)**
Set multiple environment variables for automatic fallback:

1. UniSat API (tried first)
2. OrdinalsBot API (fallback)
3. Ord CLI (final fallback)

## 📡 API Endpoints

### Proposals

- `GET /api/proposals` - Fetch proposals with pagination/filtering
- `POST /api/proposals` - Submit new proposal

### Voting

- `POST /api/vote` - Submit vote
- `GET /api/vote` - Get user votes

### System

- `GET /api/leaderboard` - Get ranked proposals
- `GET /api/blocks/latest` - Get latest Bitcoin block
- `GET /api/status` - System health check
- `POST /api/status/trigger` - Manually trigger inscription engine

### UniSat Integration

- `GET /api/unisat/order/[orderId]` - Check UniSat order status

## 🎯 Usage Guide

### For Users

1. **Visit the app** at your deployed URL
2. **Browse proposals** on the main leaderboard
3. **Submit a proposal** by clicking "Submit Your Meme"
4. **Vote on proposals** using your Bitcoin wallet address
5. **Watch the leaderboard** to see your proposal climb the ranks

### For Developers

Monitor the system:

```bash
# Check system status
curl http://localhost:3000/api/status

# Manually trigger inscription engine (with auth)
curl -X POST http://localhost:3000/api/status/trigger \
  -H "Authorization: Bearer your-cron-secret"
```

## 🎨 Customization

### Styling

- Edit `src/styles/globals.css` for global styles
- Modify Tailwind config in `tailwind.config.js`
- Update color schemes in component files

### Business Logic

- Adjust voting thresholds in `src/server/jobs/inscription-engine.ts`
- Modify inscription timing (current: every 10 minutes)
- Customize proposal validation rules

### Inscription Payload

Modify the inscription JSON structure in `src/server/services/inscription.ts`:

```typescript
generateInscriptionPayload(proposal: Proposal, blockHeight: number): InscriptionPayload {
  return {
    project: "bitmemes",
    type: "meme-coin-inscription",
    block: blockHeight,
    coin: {
      // Customize this structure
    },
  };
}
```

## 🚢 Deployment

### Database

1. Set up PostgreSQL (Supabase, Neon, or RDS)
2. Update `DATABASE_URL` in production environment
3. Run migrations: `pnpm db:migrate`

### Frontend & API

Deploy to Vercel, Netlify, or similar:

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

### Inscription Engine

For production, run the inscription engine as a separate service:

```bash
# Option 1: PM2
pm2 start "pnpm inscription-engine" --name bitmemes-inscriber

# Option 2: Docker
docker run -d --name bitmemes-inscriber your-image pnpm inscription-engine

# Option 3: Systemd service
# Create /etc/systemd/system/bitmemes-inscriber.service
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database**: Use connection pooling and proper credentials
3. **Rate Limiting**: Implement rate limiting for voting endpoints
4. **Wallet Validation**: Add proper Bitcoin address validation
5. **CORS**: Configure CORS for production domains
6. **Auth**: Consider implementing proper authentication for admin endpoints

## 🧪 Testing

```bash
# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Format code
pnpm format:write
```

## 📚 Key Technologies

- **Frontend**: Next.js 15, React 19, TailwindCSS, Framer Motion
- **Backend**: Next.js API Routes, Drizzle ORM, PostgreSQL
- **Bitcoin**: Esplora API, Ord CLI, OrdinalsBot API
- **Infrastructure**: Node.js, TypeScript, Zod validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is open source. See LICENSE file for details.

## 🙋‍♂️ Support

For questions and support:

- Create an issue on GitHub
- Check the [Ordinals documentation](https://docs.ordinals.com/)
- Visit [Blockstream](https://blockstream.info) for Bitcoin block explorer

---

**Built with ⚡ on Bitcoin** | **Powered by Ordinals** | **Made with ❤️ for the meme community**
