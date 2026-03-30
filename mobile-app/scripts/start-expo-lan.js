const os = require('os');
const { execFileSync, spawn } = require('child_process');

function getLanIp() {
  let interfaces = {};

  try {
    interfaces = os.networkInterfaces();
  } catch (error) {
    interfaces = {};
  }
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }

      candidates.push({ name, address: address.address });
    }
  }

  if (!candidates.length) {
    try {
      const output = execFileSync('hostname', ['-I'], { encoding: 'utf8' })
        .trim()
        .split(/\s+/)
        .find((address) => address && !address.startsWith('127.'));

      return output || '';
    } catch (error) {
      return '';
    }
  }

  const scoreInterface = (name) => {
    if (/^(enx|enp|eth)/i.test(name)) {
      return 0;
    }

    if (/^(wlp|wlan|wl)/i.test(name)) {
      return 1;
    }

    return 2;
  };

  candidates.sort(
    (left, right) =>
      scoreInterface(left.name) - scoreInterface(right.name) ||
      left.name.localeCompare(right.name)
  );

  return candidates[0].address;
}

const extraArgs = process.argv.slice(2);
const hasExplicitHostMode = extraArgs.some((arg) =>
  ['--host', '--lan', '--localhost', '--tunnel', '--offline'].includes(arg)
);

const env = { ...process.env };
const lanIp = getLanIp();

if (lanIp && !env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
}

const cliPath = require.resolve('expo/bin/cli');
const cliArgs = ['start', ...(hasExplicitHostMode ? [] : ['--host', 'lan']), ...extraArgs];

const child = spawn(process.execPath, [cliPath, ...cliArgs], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
