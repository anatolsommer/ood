# ood
Node.js process manager and reverse proxy

## Goal
An average sysadmin who is not familiar with node.js, should be able to install and maintain a working system that serves web pages or apps written in node.js, in a safe and reliable way. It should be possible to install, update or restart running applications within only a few seconds with zero downtime.

## Roadmap
```
2016-01-18  initial release
2016-01-25  https support (including LetsEncrypt)
2016-02     first stable release
2016-02     basic web administration interface
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
