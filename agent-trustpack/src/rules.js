'use strict';
// Detection rules. Kept dependency-free and easy to extend.

const RISKY_COMMANDS = [
  { id: 'rm-rf', sev: 'high', re: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b[^\n;|&]*(\s\/(\s|$)|\s~|\s\*|\s\$HOME)/, why: 'Recursive force delete of a broad path' },
  { id: 'pipe-to-shell', sev: 'high', re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z)?sh\b/, why: 'Downloads and executes remote code' },
  { id: 'force-push', sev: 'high', re: /\bgit\s+push\b[^\n;|&]*(--force\b|--force-with-lease|\s-f\b)/, why: 'Force push can overwrite shared history' },
  { id: 'sudo', sev: 'high', re: /(^|[;&|]\s*)sudo\s/, why: 'Privilege escalation' },
  { id: 'chmod-777', sev: 'high', re: /\bchmod\s+(-R\s+)?0?777\b/, why: 'World-writable permissions' },
  { id: 'sql-drop', sev: 'high', re: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, why: 'Destructive SQL' },
  { id: 'publish', sev: 'high', re: /\b(npm|yarn|pnpm)\s+publish\b|\btwine\s+upload\b|\bcargo\s+publish\b/, why: 'Publishes a package publicly' },
  { id: 'infra-change', sev: 'high', re: /\bterraform\s+(apply|destroy)\b|\bkubectl\s+(delete|apply)\b|\bhelm\s+(install|upgrade|uninstall)\b/, why: 'Changes live infrastructure' },
  { id: 'hook-bypass', sev: 'high', re: /--no-verify\b|--no-gpg-sign\b/, why: 'Bypasses git hooks or signing' },
  { id: 'hard-reset', sev: 'high', re: /\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f/, why: 'Discards local work' },
  { id: 'disk-write', sev: 'high', re: /\bmkfs(\.\w+)?\b|\bdd\s+if=/, why: 'Raw disk operation' },
  { id: 'pkg-install', sev: 'medium', re: /\b(npm|yarn|pnpm)\s+(install|add|i)\b|\bpip3?\s+install\b|\bapt(-get)?\s+install\b|\bcargo\s+add\b|\bgo\s+get\b/, why: 'Adds third-party code (supply-chain surface)' },
  { id: 'git-push', sev: 'medium', re: /\bgit\s+push\b/, why: 'Sends code to a remote' },
  { id: 'network-tool', sev: 'medium', re: /\b(curl|wget|nc|ncat)\b/, why: 'Outbound network request from shell' },
  { id: 'remote-shell', sev: 'medium', re: /\b(ssh|scp|rsync)\s/, why: 'Remote host access' },
  { id: 'container', sev: 'medium', re: /\bdocker\s+(run|exec|push|build)\b/, why: 'Container execution' },
  { id: 'eval', sev: 'medium', re: /\beval\s|\bbash\s+-c\b|\bsh\s+-c\b/, why: 'Dynamic command execution' },
];

const SENSITIVE_PATHS = /(^|[\/\\])(\.env(\.[\w.-]+)?|\.ssh[\/\\][^\s]*|id_(rsa|ed25519|ecdsa)|\.aws[\/\\]credentials|\.npmrc|\.netrc|\.pgpass|credentials\.json|service[-_]account[^\s\/]*\.json|[^\s\/]+\.(pem|p12|pfx|key))$/i;

const SECRET_PATTERNS = [
  { id: 'aws-access-key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { id: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'openai-key', re: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'stripe-key', re: /\b(sk|rk)_live_[0-9A-Za-z]{20,}\b/g },
  { id: 'private-key', re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { id: 'generic-secret', re: /\b(api[_-]?key|secret|token|passwd|password)\b["']?\s*[:=]\s*["']?([A-Za-z0-9/+_\-]{16,})/gi },
];

module.exports = { RISKY_COMMANDS, SENSITIVE_PATHS, SECRET_PATTERNS };
