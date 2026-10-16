# Contributing to PagePulse

Thank you for contributing to PagePulse! We welcome contributions to make website change detection more reliable, noise-free, and accessible.

## Development Workflow

1. **Fork and Clone**
   ```bash
   git clone https://github.com/JavinKapur/pagepulse-web-change-detector.git
   cd pagepulse-web-change-detector
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start Local Services**
   ```bash
   docker compose up -d
   ```

4. **Run Database Migrations**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Start Development Environment**
   ```bash
   pnpm dev
   ```

## Quality Standards

Before submitting a Pull Request, ensure all quality checks pass:
- **Lint:** `pnpm lint`
- **Typecheck:** `pnpm typecheck`
- **Unit & Integration Tests:** `pnpm test`
- **Build:** `pnpm build`

## Pull Request Guidelines

- Branch naming: `feat/...`, `fix/...`, `docs/...`, `chore/...`
- Keep commits clear, concise, and focused.
- Include unit/integration tests for any new change detection or filtering logic.
- Avoid committing secrets, credentials, or `.env` files.
