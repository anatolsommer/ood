# ood
Node.js process manager and reverse proxy


## Goal
An average sysadmin who is not familiar with node.js, should be able to install and maintain a working system that serves web pages or apps written in node.js, in a safe and reliable way. It should be possible to install, update or restart running applications within only a few seconds with zero downtime.


## Features
* System service
  * Brings up apps on reboot if they were started
  * Restarts your apps if they crash
* Minimal configuration
* Apps are easily scalable
* Automatic load-balancing between workers
* Optionally set UID, GID and env for each separate app
* One CLI to rule them all
  * Make ood serving a new app with one single command
  * Restart apps with 0s downtime
  * Autocomplete (with intelligent app name suggestions)
  * Allow specific users to run the ood command
  * Show or change system or app configuration
  * Check the health of apps and workers
  * Read log files
  * Manage ssl certificates
* Reverse proxy
  * Aliases and redirects
  * Scalable
  * HTTPS with SNI
    * Import existing certificates
    * Wildcard certificate support
    * Free certificates from letsencrypt.org
      * A single command and your work is done
      * Automatic renewal
* Extendable
  * API
  * Module system
* Tested with node v0.12, v4.2, v4.3, v5.5 and v5.6 on
  * Ubuntu 14.04
  * Ubuntu 15.04
  * Ubuntu 15.10
  * Debian 8.2
  * CentOS 7.2


## Roadmap
```
2016-01-18 ✔ initial release (without proxy)
2016-01-22 ✔ reverse proxy
2016-01-24 ✔ redirects
2016-01-29 ✔ https support
2016-01-31 ✔ ssl --auto (Let's Encrypt)
2016-02-01 ✔ shell autocomplete
2016-02-05 ✔ container states (handle crashing apps)
2016-02-07 ✔ logging for apps
2016-02-12 ✔ monitoring sensors, load-balancing probe
2016-02-14 ✔ api client, module system
2016-02-16 ✔ wildcard certificate support
2016-02-18 ✔ access logs
2016-02-21 ✔ first stable release candidate
2016-02-27 ✔ v1.0.0 (stable)
2016-03-06 ✔ basic web administration interface (module)
```

### Next steps
* Loads of tests
* Documentation
* Improve module system
  * Root permission / drop privileges
  * Official modules (whitelist)
  * Install routines for modules
  * util.prompt
* Autorestart on memory usage or uptime
* Modules
  * Improve ood-webadmin
  * Improve ood-monitoring
  * Watch files and restart app on change
* PKCS#12 support (.pfx)


## Installing ood
```
sudo npm install -g ood
sudo ood install
```


## Tutorials
* [Installing ood](https://github.com/anatolsommer/ood/blob/master/tutorial/Installing%20ood.md)
* [Getting started](https://github.com/anatolsommer/ood/blob/master/tutorial/Getting%20started.md)


## CLI
```

  Usage: ood [command]

  Commands:
    init [options] <app>                Initialise a new app
    start <app>                         Start an app
    stop <app>                          Stop a running app
    restart <app>                       Restart a running app
    scale <app> <instances>             Kill or fork new worker instances
    redirect [options] <host> [target]  Set http redirect for a hostname
    status                              Show status of all apps
    status [app]                        Show status of a running app
    config [options]                    Modify or show configuration
    ssl [options]                       Manage ssl certificates and keys
    log [options]                       Read log files
    mod [options]                       Manage ood modules
    install                             Install and start system service
    help [command]                      Show help
  
  Examples:
    ood help init
    ood help config
    ood init example.com --alias www.example.com
    ood start example.com
    ood scale example.com 4
    ood stop testapp
    ood status
    ood redirect www.example.com https://example.com
    ood redirect http://example.com https://example.com
    ood redirect --delete www.example.com
    ood config --get
    ood config --get httpPort
    ood config --set httpsPort 443
    ood config --get --app example.com
    ood config -ga example.com
    ood config -a example.com -g port
    ood config -a testapp -s cwd /home/test/testapp
    ood ssl --auto example.com --email me@example.com --agree
    ood ssl --auto example.org # (If you supplied --email before)
    ood ssl --list

```


## Tests
Run tests with `npm test` or generate coverage reports with `npm run test-cov`.


## License
#### MIT
