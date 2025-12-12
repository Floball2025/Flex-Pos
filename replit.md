# Bem Lindinha - Sistema de Fidelidade

## Overview
Bem Lindinha é um sistema de acumulação de pontos de fidelidade projetado para processar transações de clientes de forma eficiente. Suporta transações via códigos QR ou entrada manual de ID/telefone do cliente. O sistema visa aumentar a fidelidade do cliente, agilizar o processamento de transações e fornecer insights valiosos através de analytics. Principais capacidades incluem configuração de terminal, vários métodos de identificação de clientes, processamento robusto de transações, rastreamento histórico e capacidades offline.

## User Preferences
I want iterative development. I prefer detailed explanations. Ask before making major changes. Do not make changes to the folder `Z`. Do not make changes to the file `Y`. I want the agent to use clear and concise language. I like functional programming paradigms where applicable.

## System Architecture
The application features a React-based frontend with TypeScript, utilizing Shadcn UI and Tailwind CSS for a professional, responsive interface. State management is handled by React Query for API calls and localStorage for persistence. The backend is an Express.js server in TypeScript, managing REST API endpoints and in-memory transaction history.

**UI/UX Decisions:**
- **Design System:** Uses Shadcn UI with Tailwind CSS for a consistent and modern look.
- **Color Scheme:** Primary blue for interactive elements, red for destructive actions, green for success, and gray for muted elements.
- **Typography:** Roboto font family with defined sizes and weights for titles, subtitles, and body text.
- **Layout:** Standard padding and spacing for readability and clear separation of components.

**Technical Implementations:**
- **Frontend:** React 18, TypeScript, Wouter for routing, html5-qrcode for QR scanning, React Hook Form and Zod for form validation.
- **Backend:** Node.js, Express, TypeScript, Zod for schema validation.
- **Database:** PostgreSQL (Neon) with Drizzle ORM for persistent configuration storage across all devices and sessions.
- **Data Persistence:** Terminal configurations stored in PostgreSQL database with shared fallback system. Transaction history and product data stored in localStorage.
- **Configuration Sync:** Database-backed per-user configuration storage with automatic synchronization across all devices and browsers. React Query manages server state with auto-migration from localStorage to database on first access.
- **Authentication:** JWT-based external API authentication.
- **Hashing:** Web Crypto API (SHA-1) for client ID and phone number conversion.
- **Offline Mode:** Utilizes `navigator.onLine` with a retry mechanism and `localStorage` queue for offline transactions.
- **Error Handling:** Comprehensive error mapping with 20+ result codes, providing clear messages and recommended actions.

**Feature Specifications:**
- **Terminal Configuration:** Customizable host, authentication credentials, endpoint paths, and transaction mode (fixed vs variable), synchronized across devices via server storage with localStorage as backup/cache. **Shared configuration system**: operators (badmin) automatically inherit terminal configuration from admin, eliminating need for per-user setup on new devices.
- **Customer ID Input:** Supports QR code scanning and manual entry for client ID (0e+SHA1 format) and phone (0f+SHA1 format). Phone numbers are automatically formatted with country/area codes: 9 digits adds "5561" prefix, 11 digits adds "55" prefix, 13 digits used as-is.
- **Balance Query:** Automatically displays client balance after QR code scan or when client ID/phone number is entered. Uses actionType "3" to query balance from external API. Balance is displayed in a prominent card above transaction amount field.
- **Transaction Processing:** Handles authentication token acquisition, detailed transaction data submission (including product information), and displays immediate feedback via modals. **Supports two modes: Pontuação (fixed R$ 1,00) or Normal (user-entered amount) controlled by useFixedAmount toggle in configuration.**
  - **Regular Sales (actionType "4"):** "Enviar Venda" button processes loyalty points accumulation
  - **Cashback Redemption (actionType "8"):** "Resgatar Cash Back" button opens modal showing client balance and requesting withdrawal amount before processing cashback transaction
- **Transaction History:** Displays the last 5 transactions on the home screen, with export options (CSV/PDF).
- **Product Management:** Allows adding/removing products, with a default "Bem Lindinha" product, and calculates `totalAmount` automatically.
- **Analytics Dashboard:** Provides metrics (total transactions, points distributed, unique customers, success rate) and charts (transactions by date, success vs. failure) for various periods using Recharts.
- **User Authentication:** Hardcoded user roles (`badmin` as operator, `admin` as administrator) with route protection and login screen.
- **Transaction Logging:** Comprehensive logging system that captures all API requests/responses for debugging purposes, with JSON/TXT export capabilities in chronological order (oldest first) with Brasília timezone format and automatic sanitization of sensitive data (passwords redacted).

## Recent Changes
- **November 19, 2025 - Comprehensive Code Documentation:** Added extensive inline comments to critical codebase sections for junior developer onboarding (~$1 investment). Documented: (1) Timestamp hour 24→00 midnight bug fix and Brasília timezone handling in server/utils/timestamps.ts, (2) Drizzle ORM snake_case→camelCase quirk with production bug examples (logo_url vs logoUrl) in shared/schema.ts and server/routes.ts, (3) Phone number E.164 formatting rules with failure modes (8-digit landlines, other states, international) in client/src/pages/home.tsx, (4) Centavos conversion with locale decimal bug (.replace(',', '.')) and L2Flow integer requirements in client/src/pages/home.tsx. Comments explain "why" (business rules, API requirements) not just "what" (code actions), include historical bugs, and provide cross-references between related files.
- **November 5, 2025 - Rebranding para Bem Lindinha:** Sistema totalmente rebrandizado de Nube/Café Pontua para Bem Lindinha Acessórios. Atualizações incluem: logo substituído em todas as páginas, usuários de login alterados (badmin/admin com senha aws456), produto padrão renomeado, títulos e meta tags atualizados, referências em logs e exports atualizados, fallback de configuração ajustado para apenas admin e badmin.
- **November 4, 2025 - PostgreSQL Database Integration:** Migrated configuration storage from volatile memory to PostgreSQL database for permanent persistence. Configurations now survive server restarts and are accessible from any device or browser session. Implemented DatabaseStorage class with Drizzle ORM, maintaining the same shared configuration fallback system (admin → badmin → any available).
- **November 3, 2025 - Cashback Modal Flow:** Modified cashback redemption to display modal with client balance and withdrawal amount input. User clicks "Resgatar Cash Back" → modal shows available balance → user enters desired amount → confirms to process withdrawal.
- **October 31, 2025 - Shared Configuration System:** Implemented automatic configuration sharing between users. When an operator (badmin) accesses from a new device, they automatically inherit the terminal configuration from admin or any other configured user, eliminating the need to configure each user separately on each device.
- **October 31, 2025 - Timestamp Fix:** Fixed RRN and created timestamps to correctly display October (10) instead of advancing to November (11). Improved getBrasiliaTimeComponents to extract date components directly without intermediate Date object conversion.
- **October 31, 2025 - Balance Query Feature:** Implemented automatic balance query that displays client balance immediately after QR code scan or when client ID/phone number is entered. New `/api/balance` endpoint uses actionType "3" for balance queries. Balance displayed in prominent blue gradient card showing amount in R$ with loading state. Balance automatically clears when client identification is removed.
- **October 31, 2025 - Placeholder Removal:** Removed example "100.00" placeholder from transaction amount input field for cleaner interface.
- **October 31, 2025 - Cashback Redemption Feature:** Implemented "Resgatar Cash Back" button with actionType "8" for cashback withdrawal. Follows same value/quantity rules as regular sales (values in centavos, quantity "1000"). Separate endpoint `/api/cashback` with full logging support (frontend console and backend logs). Transaction timestamps use Brasília timezone. Logs export in chronological order with complete product details.
- **October 31, 2025 - Log Export Improvements:** Fixed log export to show chronological order (oldest first). Transaction timestamps now display in Brasília format (YYYY-MM-DD HH:mm:ss.SSS (Brasília)) instead of UTC. Products array always included in exported logs with complete field details.
- **October 31, 2025 - Correções Críticas de Processamento:** Implementadas três correções essenciais: (1) Valores de produtos (pCost/price) agora refletem corretamente o transactionAmount em centavos (ex: "150" → 15000 centavos em totalAmount, pCost e price), (2) quantity sempre fixo em "1000" conforme especificação, (3) timestamps (created/rrn) agora usam timezone de Brasília (America/Sao_Paulo, UTC-3) ao invés de UTC. Logs detalhados adicionados no frontend (console.log do JSON enviado) e backend (JSON recebido, conversões, requests/responses).
- **October 31, 2025 - Restauração Modo Valor Variável:** Restaurada funcionalidade de valor variável com toggle configurável. Sistema agora permite escolher entre Modo Pontuação (R$ 1,00 fixo) ou Modo Normal (valor digitado). Implementado activeConfig para sincronizar UI e processamento, garantindo consistência entre servidor e localStorage. Validação estrita (=== true) previne problemas com undefined/null.
- **November 4, 2025 - Logo Bem Lindinha Adicionado:** Implementado logo da Bem Lindinha Acessórios nas páginas de login e home. Logo proporciona identidade visual consistente. Tamanhos: 96px (login) e 64px (home), ambos responsivos e centralizados.
- **October 29, 2025 - Configuration Synchronization:** Implemented server-backed configuration storage with automatic cross-device synchronization. Configurations are now stored per-user on the server with automatic migration from localStorage. React Query manages server state with localStorage maintained as backup/cache. Operators can now access their terminal settings seamlessly on any device (desktop or mobile).
- **October 28, 2025 - Transaction Logging System:** Implemented comprehensive logging that captures all transaction steps including API requests, responses, and errors. Logs are stored in localStorage (max 100 entries) and can be exported in JSON or TXT format from the configuration page. All sensitive fields (aid_pass) are automatically sanitized as ***REDACTED*** before storage.

## External Dependencies
- **Authentication API:** External HTTP service for obtaining JWT tokens.
- **Transaction Processing API:** External HTTP service for submitting transaction data.
- **html5-qrcode:** Library for QR code scanning functionality.
- **Shadcn UI:** UI component library.
- **Tailwind CSS:** Utility-first CSS framework.
- **TanStack Query:** Data fetching and state management library.
- **Wouter:** Lightweight React router.
- **Recharts:** Charting library for the analytics dashboard.