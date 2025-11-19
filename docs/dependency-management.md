# Dependency Management

## Automated Dependency Checking

This project uses `depcheck` to automatically detect unused and missing dependencies, similar to how linters detect unused imports.

## Usage

### Check for unused/missing dependencies
```bash
npm run deps:check
```

This will scan the codebase and report:
- Unused dependencies
- Unused devDependencies
- Missing dependencies (used but not in package.json)

### CI/CD Integration
```bash
npm run deps:check-ci
```

This command exits with code 1 if any issues are found, making it suitable for CI pipelines.

## Configuration

The `.depcheckrc.json` file configures depcheck to ignore build tools and development utilities that are used indirectly:

- **Build tools**: vite, electron-builder, postcss, tailwindcss, autoprefixer
- **CLI tools**: concurrently, wait-on, dotenv-cli, electron-rebuild, depcheck
- **Testing**: jest, jest-environment-jsdom, babel-jest, identity-obj-proxy
- **Linting**: eslint, eslint-plugin-react
- **Babel presets**: @babel/preset-env, @babel/preset-react
- **Notarization**: @electron/notarize

## Best Practices

1. **Run before committing**: Check for unused dependencies before committing changes
   ```bash
   npm run deps:check
   ```

2. **Regular audits**: Periodically review dependencies to keep the project lean
   ```bash
   npm run deps:check
   ```

3. **Add to CI pipeline**: Include dependency checking in your CI workflow to prevent unused dependencies from being merged

4. **When adding new build tools**: If you add a new build tool or CLI utility that's used indirectly (like in npm scripts or config files), add it to `.depcheckrc.json`'s `ignores` array

## Recent Changes

### 2025-11-19 - Initial Cleanup
- **Removed**: `electron-store` (unused)
- **Added**: `axios` (missing but used in multiple services)
- **Added**: `@types/jest`, `@types/node` (TypeScript type definitions)
- **Added**: `depcheck` (automated dependency checking)

## Integration with Existing Tooling

Dependency checking complements existing code quality tools:

- **ESLint**: Checks for unused imports in code
- **Depcheck**: Checks for unused libraries in package.json
- **Jest**: Runs unit tests
- **TypeScript**: Type checking (via tsconfig.json)

Run all checks together:
```bash
npm run lint && npm run deps:check && npm test
```

## Troubleshooting

### False Positives

If depcheck reports a dependency as unused but it's actually needed (e.g., used in config files), add it to `.depcheckrc.json`:

```json
{
  "ignores": [
    "your-dependency-name"
  ]
}
```

### Missing Dependencies

If depcheck reports missing dependencies, install them:
```bash
npm install <package-name>
```

For development dependencies:
```bash
npm install --save-dev <package-name>
```
