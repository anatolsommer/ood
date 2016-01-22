# Installing ood

## Installing node
```
curl https://nodejs.org/dist/v4.2.6/node-v4.2.6-linux-x64.tar.gz | sudo tar -C /usr/local --strip-components 1 -xzf -
```

## Installing build-essential package (Debian/Ubuntu)
```
apt-get update && apt-get install build-essential
```

## Installing ood package and service
```
npm install -g ood
ood install
```

## Check if everything works
```
root@test:~# ood log

  Time      Type   App              Message  
  19:05:32  INFO   ood-brain        Starting...  
  19:05:33  INFO   ood-api-server   Starting...  
  19:05:33  INFO   ood-api-server   Listening on port 4126  
  19:05:33  INFO   proxy            Starting...  
^C
root@test:~# ood status

  App name          PID  Worker  State             Uptime      CPU        RAM  
  proxy            7672  MASTER  ok           0d 00:00:15    0.51%   15.35 MB  
                   7677      #1  listening    0d 00:00:15    0.64%   16.95 MB  
                   7678      #2  listening    0d 00:00:15    0.64%   16.95 MB  
                   7683      #3  listening    0d 00:00:15    0.58%   16.95 MB  
                   7688      #4  listening    0d 00:00:15    0.58%   16.95 MB  

```

