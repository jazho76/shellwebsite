import type { PluginInstall } from '../core/kernel.js';
import { dir, file, treeMount } from '../core/vfs.js';

const buildEtc = () =>
  dir({
    passwd: file(
      'root:x:0:0:chop wood:/root:/bin/bash\n' +
        'daemon:x:1:1:carry water:/usr/sbin:/usr/sbin/nologin\n' +
        'guest:x:1000:1000:just visiting:/home/guest:/bin/bash'
    ),
    shadow: file(
      'root:$6$rounds=656000$saltsalt$kFz9R3qPbMiDjqwHzkx1:19854:0:99999:7:::\n' +
        'daemon:*:19854:0:99999:7:::\n' +
        'guest:$6$guest$Wq3xR7mNpPvYbTz0sK8d:19854:0:99999:7:::',
      undefined,
      { mode: 0o600 }
    ),
    hostname: file('jpinillos.dev'),
    motd: file(
      'before enlightenment, chop wood, carry water.\nafter enlightenment, chop wood, carry water.'
    ),
    'os-release': file(
      'NAME="Arch Linux"\n' +
        'PRETTY_NAME="Arch Linux"\n' +
        'ID=arch\n' +
        'BUILD_ID=rolling\n' +
        'HOME_URL="https://archlinux.org/"'
    ),
    'resolv.conf': file('nameserver 127.0.0.1'),
  });

const install: PluginInstall = kernel => {
  kernel.registerMount(treeMount('/etc', buildEtc));
};

export default install;
