# Dreadnot - deploy without dread

Dreadnot is a 'one click' deploy tool written in [Node.js](http://www.nodejs.org/).

Dreadnot was heavily inspired by [Etsy's Deployinator](https://github.com/etsy/deployinator/).

![Deploy all the branches](https://raw.githubusercontent.com/wiki/racker/dreadnot/images/dat.jpg)

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

  // Base URL to access dreadnot (used in IRC, email, Hipchat)
  default_url: 'http://example.com',
  
  // Dreadnot can use an htpasswd ("htpasswd") file or LDAP ("ldap") for auth 
  auth_method: 'htpasswd',

  // Dreadnot uses an htpasswd file (with support for md5 and sha1) for auth
  htpasswd_file: '/etc/dreadnot/htpasswd',
  
  // If auth_method is set to 'ldap', the following LDAP configuration is used for auth validation
  ldap:{
    url: 'ldap://ipa:389',
    adminDn: 'uid=freeipa-bin,cn=users,cn=accounts,dc=somecompany,dc=com',
    adminPassword: 'secret',
    searchBase: 'cn=users,cn=accounts,dc=somecompany,dc=com',
    searchFilter: '(&(memberOf=cn=dreadnot,cn=groups,cn=accounts,dc=somecompany,dc=com)(uid={{username}}))'
  },

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
    },

    // A Hipchat notification plugin
    hipchat: {
      name: 'Dreadnot',
      apiKey: '123456789abcdefg',
      rooms: [
        1234,
        5678
      ]
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

### Tasks

In the configuration used by Rackspace Cloud Monitoring, a deployment looks something like:

1. Build: verify that the requested revision has been successfully built and
   that all tests pass.
2. Prepare: remove the region being deployed from the load balancer rotation,
   redirecting all traffic to another region.
3. Execute: use a chef search to locate all servers in the region, then ssh to
   each in parallel to upgrade the code.
4. Validate: execute checks against each upgraded service to verify that it is
   functioning properly.
5. Restore: restore the region to the load balancer rotation.

Imporantly, Dreadnot knows nothing about the hosts to which it is deploying -
if it did, we would have to modify our Dreadnot configuration every time we
added or removed a machine from our environment. Instead, we rely on chef
(although anything that knows about your servers will work) to give us an
up-to-date list of all hosts in a given region. In smaller deployments it might
be suitable to hardcode a list of hosts.

## FAQ

**Does Dreadnot support SVN?**

Dreadnot supports Node.js - you can use any technology or topology that suits you, as long as you can find a library for it.

## Running Dreadnot

```
	npm install dreadnot -g

```

Dreadnot takes a number of options on the command line. The defaults are:

```
  dreadnot -c ./local_settings.js -s ./stacks -p 8000

```

This will start dreadnot with the specified config file and stack directories,
listening on port 8000.
