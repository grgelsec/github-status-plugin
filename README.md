# GitHub status for Claude Code

Shows [GitHub's status](https://www.githubstatus.com) under the Claude Code prompt, refreshed every minute, with a toast when the overall status changes.

```
✓ GitHub: All Systems Operational
▲ GitHub: Partial System Outage (Actions, Pages)
```

## Install

In a Claude Code terminal session:

```
/plugin install github-status --marketplace grgelsec/github-status-plugin
```

Answer `y` to add the marketplace, then pick a scope (user installs it for every session). The line appears under the prompt right away.

Or from a shell:

```
claude plugin marketplace add grgelsec/github-status-plugin
claude plugin install github-status@github-status-plugin
```

Uninstall with `claude plugin uninstall github-status`.

`? GitHub: status unavailable` means www.githubstatus.com could not be reached or read.

## Development

```
claude --plugin-dir .      # runs it from this folder and writes the types tsconfig.json reads
claude plugin validate .
claude plugin test .
```
