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
  * Show or change system or app configuration
  * Check the health of apps and workers
  * Read log files
  * Manage ssl certificates
* Reverse proxy
  * Aliases and redirects
  * Scalable
  * HTTPS
    * Import existing certificates
    * Free certificates from letsencrypt.org
      * A single command and your work is done
      * Automatic renewal
* Tested on
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
2016-02-07   logging for apps
2016-02-08   monitoring sensors, load-balancing probe
2016-02-12   api client
2016-02-19   first stable release
2016-02      basic web administration interface
```


## Installing ood
```
sudo npm install -g ood
sudo ood install
```

### Allow specific users to run the ood command
```
sudo addgroup ood
sudo ood config --set gid ood
sudo chown -R root:ood /etc/ood
sudo usermod -aG ood yourusername
sudo usermod -aG ood anotherusername
```
The new group will only apply to new sessions, so you will have to relog.


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
    config [options]                    Modify or show config
    ssl [options]                       Manage ssl certificates and keys
    log                                 Read log files
    install                             Install and start system service
    help [command]                      Show help
  
  Examples:
    ood help init
    ood help config
    ood init example.com --alias www.example.com
    ood start example.com
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


## Concept
### ood brain (system service)
* Runs as root so it can set UID for apps
* Binds only to loopback interface
* All child processes are dropping root privileges
```
child.fork -> appContainer 1 (master)
  cluster.fork -> worker 1
  cluster.fork -> worker 2
  cluster.fork -> worker n
child.fork -> appContainer 2 (master)
  cluster.fork -> worker 1
  cluster.fork -> worker n

child.fork -> proxy

include api-server
  http.listen
```

### ood cli
```
include api-client
  http.post
```

`ood init example.com` add app to config and assign port

`ood start example.com` start app (appContainer in cluster mode)

`ood scale example.com 12` kill or spawn workers (send message to appContainer)

`ood config --set httpPort 80`

`ood config --get httpsPort`

`ood config --app example.com --set cwd /var/www/example.com`
