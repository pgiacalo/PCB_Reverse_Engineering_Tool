# Release Notes

This directory contains release notes for each version of the PCB Reverse Engineering Tool.

## Format

Each release has its own markdown file named `v<major>.<minor>.<patch>.md` (e.g., `v2.2.0.md`).

## Contents

Release notes document:
- Major new features
- Bug fixes
- UI/UX improvements
- Technical improvements
- Breaking changes (if any)
- Migration notes (if applicable)

## Version Tagging

Each release is tagged in the git repository using the format `v<major>.<minor>.<patch>` (e.g., `v2.2.0`).

To create a new release:
1. Update version number in `src/constants/index.ts` and `package.json`
2. Create a new release notes file in this directory
3. Commit all changes
4. Tag the release: `git tag -a v<major>.<minor>.<patch> -m "Release v<major>.<minor>.<patch>"`
5. Push commits and tags: `git push && git push --tags`

