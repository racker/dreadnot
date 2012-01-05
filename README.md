# Dreadnot - deploy without dread

Dreadnot is a 'one click' deploy tool written in [Node.js](http://www.nodejs.org/).

Dreadnot was heavily inspired by [Etsy's Deployinator](https://github.com/etsy/deployinator/).


## Configuration

Dreadnot loads its configuration from a javascript file:

```javascript
exports.config = {
  // The name of this Dreadnot instance, used for display
  name: 'Example Dreadnot',

  // Each Dreadnot instance supports one environment such as 'dev', 'staging'
  // or 'production'
  env: 'staging',

  // The data root Dreadnot will use
  data_root: '/var/dreadnot',

  // Base URL to access dreadnot (used in IRC, email)
  default_url: 'http://example.com',

  // Dreadnot uses an htpasswd file (with support for md5 and sha1) for auth
  htpasswd_file: '/etc/dreadnot/htpasswd',

  // Each stack represents a code base that should be deployed to one or more regions
  stacks: {

    // For a stack named 'webapp', there should be a 'webapp.js' file in the
    // stacks directory
    webapp: {
      // What branch to look in for the latest revision of the code base
      tip: 'master',

      // How long to cache the latest revision of the code base
      tip_ttl: 120 * 1000,

      // What regions this stack should be deployed to
      regions: ['ord1'],

      // Stacks should implement dryrun for testing
      dryrun: true
    }
  },

  // The GitHub organization you provide is used to build URLs for your stacks
  github: {
    organization: 'racker'
  },

  // Plugins provide optional functionality such as notifications. Any plugins
  // that are not configured won't be used.
  plugins: {

    // An IRC notification plugin
    irc: {
      nick: 'staging-dreadnot',
      channels: {'irc.freenode.net': ['#public-channel', '#private-channel pass']}
    },
    
    // An email notification plugin
    email: {
      server: {
        user: 'staging-dreadnot@example.com',
        password: '',
        host: 'smtp.example.com',
        ssl: true
      },
      to: 'systems@example.com',
      from: 'staging-dreadnot@example.com'
    }
  }
};
```

## Stacks

Dreadnot looks in a directory (by default `./stacks`, but this can be changed
from the command line) for "stack files". A stack file is simply a javascript
file that exports

* A `get_deployedRevision` function which takes an object containing
  `environment` and `region` fields, and a callback taking `(err,
  deployed_revision)`.
* A `targets` hash that maps target names to lists of task names. Currently,
  the only supported target is `deploy` which defaults to
  `['task_preDeploy', 'task_deploy', 'task_postDeploy']`.
* One or more "task functions" whose names are prefixed with `task_`. Each
  task function takes:
  1.  A "stack" object. The most useful fields on the stack are `stackConfig`
      which contains the config for this particular stack, and `config` which
      contains the global config.
  2.  A "baton" object. Each task executed during a run of a given target
      receives the same baton object. By default, it contains a `log` field
      with methods such as `debug`, `info`, and `error` that can be used to
      log output to deployment log and web view.
  3.  An "args" hash with `dryrun`, `environment`, `region`, `revision` and
      `user`, each of which is a string.
  4.  A "callback" function that should be called without arguments on
      completion, or with a single error object if an error occurs.


## Running Dreadnot

Dreadnot takes a number of options on the command line. The defaults are:

```
  dreadnot -c ./local_settings.js -s ./stacks -p 8000

```

This will start dreadnot with the specified config file and stack directories,
listening on port 8000.
