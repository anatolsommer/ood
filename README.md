# ood
Node.js process manager and reverse proxy

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
