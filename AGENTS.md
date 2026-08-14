# SocialToSite agent rules

These rules apply to every coding agent working in this repository.

## `deployvps` is a reserved production command

When the user says exactly `deployvps`, treat it as an explicit request to publish the current intended work to production using the canonical Git + GitHub Actions + FTP/FTPS pipeline.

Required sequence:

1. Save all edited files locally.
2. Stage and commit the intended changes on `main`.
3. The production commit message must contain `[deployvps]`.
4. Synchronize with `origin/main` without discarding local work.
5. Push `main` to GitHub.
6. `.github/workflows/deploy.yml` performs PHP checks, tests, Vite build, release packaging, FTP/FTPS upload and production release verification.
7. Confirm the workflow result; do not claim production success before verification succeeds.

Preferred local implementation: run `./deployvps.sh` from the repository root. On Windows environments without Bash, reproduce the same Git sequence and push a HEAD commit containing `[deployvps]`; the build/upload itself is performed by GitHub Actions and is therefore OS-independent.

Production URL: `https://213.32.22.252/`.

## Hard prohibition

`deployvps` NEVER means Docker deployment. Do not run Docker down/up/build/restart/rm/cp, do not recreate containers, do not edit files inside a container, and do not substitute SSH/SCP/rsync for FTP. Docker administration requires a separate explicit user request.

Do not infer the FTP filesystem path from the HTTPS URL. FTP connection values come from GitHub Secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASS`) and the optional repository variable `FTP_REMOTE_DIR`.

If required access is unavailable, stop at the unavailable step and report it. Never silently switch deployment strategy.
