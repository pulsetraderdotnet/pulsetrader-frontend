# PulseTrader

**PulseTrader** is a Multi-Chain Quantitative Terminal designed to empower traders with high-frequency precision directly from their wallets. By combining an advanced strategy execution engine with multi-chain compatibility, it allows you to trade on the edge of every signal with zero counterparty risk.

## 🚀 Features

*   **Strategy Engine:** Set up automated execution logic based on technical indicators (e.g., auto-buys on RSI oversold or EMA crossovers).
*   **Multi-Chain Hub:** A unified interface seamlessly connecting Ethereum, Solana, Base, Arbitrum, Polygon, BSC, and other EVM L2s.
*   **Futures & Spot Trading:** Access high-leverage perpetuals or deep-liquidity spot swaps all within one streamlined terminal.
*   **Non-Custodial Design:** PulseTrader does not hold your funds. Execute trades directly from your own wallet securely.

## 🛠 Tech Stack

PulseTrader is built with modern, performant web technologies:

*   **Framework:** Next.js 16 (React 19)
*   **Styling:** Tailwind CSS v4, framer-motion (animations), next-themes (dark/light mode)
*   **Web3:** ethers.js v6
*   **State Management:** Zustand
*   **Data Visualization:** Recharts

## 💻 Getting Started

To run the development server locally:

1.  Clone the repository and install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
3.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the terminal.

## 🏗 Project Structure

*   `/app` - Next.js app router pages and layouts.
*   `/components` - Reusable UI components.
*   `/domain` - Core business logic and domain entities.
*   `/service` - External API and Web3 integration services.
*   `/store` - Zustand state management stores.
*   `/lib` & `/utility` - Helper functions and utility classes.

---
*Developed for High-Frequency Precision*
