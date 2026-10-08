// Scheduler job definitions: launchd plist (macOS), systemd user units and a cron line, and the
// Claude Code hook snippet that `harbordeck scheduler install` prints.
import path from 'node:path';
import crypto from 'node:crypto';

const sha = (s, n) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, n);

export function launchdLabel(home, defaultHome) {
  return home === defaultHome ? 'dev.harbordeck.scheduler' : `dev.harbordeck.scheduler.${sha(home, 8)}`;
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function launchdPlist({ label, node, bin, home, envPath, interval = 60 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- harbordeck scheduler: runs "harbordeck tick" every ${interval}s. Remove with "harbordeck scheduler uninstall". -->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(node)}</string>
    <string>${xml(bin)}</string>
    <string>tick</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HARBORDECK_HOME</key>
    <string>${xml(home)}</string>
    <key>PATH</key>
    <string>${xml(envPath)}</string>
  </dict>
  <key>StartInterval</key>
  <integer>${interval}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>${xml(path.join(home, 'schedule', 'launchd.err'))}</string>
</dict>
</plist>
`;
}

export function systemdUnits({ node, bin, home, envPath, interval = 60 }) {
  const q = (s) => `"${String(s).replace(/(["\\])/g, '\\$1')}"`;
  return {
    service: `[Unit]\nDescription=harbordeck scheduler tick\n\n[Service]\nType=oneshot\nEnvironment=HARBORDECK_HOME=${q(home)}\nEnvironment=PATH=${q(envPath)}\nExecStart=${q(node)} ${q(bin)} tick\n`,
    timer: `[Unit]\nDescription=harbordeck scheduler tick every ${interval}s\n\n[Timer]\nOnBootSec=${interval}\nOnUnitActiveSec=${interval}\n\n[Install]\nWantedBy=timers.target\n`,
    cron: `* * * * * HARBORDECK_HOME=${q(home)} PATH=${q(envPath)} ${q(node)} ${q(bin)} tick`,
  };
}

export function hookSnippet(bin) {
  return JSON.stringify({ hooks: { StopFailure: [{ matcher: 'rate_limit', hooks: [{ type: 'command', command: `${bin} limit record` }] }] } }, null, 2);
}
