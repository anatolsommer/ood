# Getting started

## Initialising our first app
First we create a new directory for our apps containing our app directory. In this tutorial we will use `/var/node` but you can also use `/var/www` or anything else.
```
mkdir -p /var/node/example.com
cd /var/node/example.com
```

Now we create a file called `app.js`:
```js
var http=require('http'), server;

server=http.createServer(function(req, res) {
  res.write(process.title);
  res.end();
});

server.listen(process.env.PORT);
```
This is a very simple http server responding it's own process title and listening on a port ood passed using the PORT environment variable.

Now we can initialise and start our app:
```
ood init example.com
```
![Screenshot](https://raw.githubusercontent.com/anatolsommer/ood/master/tutorial/ood-init.png)

If we use a real domain pointing to this server or adding example.com to our local `/etc/hosts` file, a browser will show something like `ood: example.com - Worker #2` if we navigate to http://example.com (or the domain used instead). Reloading the page a few times will show that the worker id changes, so  we know our requests are load-balanced between both workers. If we want more than only two wokers we can simply scale our app:
```
ood scale example.com 6
```
![Screenshot](https://raw.githubusercontent.com/anatolsommer/ood/master/tutorial/ood-scale.png)

## Aliases and redirects
```
ood config --app example.com --set alias www.example.com
```
This will show the same content on example.com and www.example.com.

If we want to redirect www.example.com to example.com, we can do the following:
```
ood config --app example.com --delete alias
ood redirect www.example.com http://example.com
```

Later, after setting up SSL we might want to redirect to https://example.com:
```
ood redirect http://example.com https://example.com
ood redirect www.example.com https://example.com
ood redirect www.example.org https://example.com
ood redirect example.org https://example.com
```

If we decide to build a seperate example.org app later, we can easily change this:
```
ood redirect http://example.org https://example.org
ood redirect www.example.org https://example.org
```
