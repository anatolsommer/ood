# Installing ood

## Installing node
```
curl https://nodejs.org/dist/v4.3.1/node-v4.3.1-linux-x64.tar.gz | sudo tar -C /usr/local --strip-components 1 -xzf -
```

## Installing ood package and service
```
sudo npm install -g ood
sudo ood install
```

## Source autocomplete
Autocomplete will be available in new sessions only, so you will have to relog or run:
```
. <(ood autocomplete)
```
This will source autocomplete to your current session.

## Check if everything works
```
root@tutorial:~# ood log

  Time      Type   App              Message  
  19:08:43  INFO   ood-brain        Starting...  
  19:08:44  INFO   ood-api-server   Starting...  
  19:08:44  INFO   ood-api-server   Listening on port 4126  
  19:08:44  INFO   proxy            Starting...  
  19:08:46  INFO   proxy            App successfully started!  
^C
root@tutorial:~# ood status

  App name                 PID  Worker  State             Uptime     CPU        RAM  
  proxy                   1619  MASTER  running      0d 00:00:04    1.2%   25.98 MB  
                          1624      #1  listening    0d 00:00:04    0.0%   40.36 MB  
                          1625      #2  listening    0d 00:00:04    0.0%   38.29 MB  
                          1630      #3  listening    0d 00:00:04    0.0%   40.29 MB  
                          1635      #4  listening    0d 00:00:04    0.0%   40.29 MB  

```

## Allow specific users to run the ood command
```
sudo addgroup ood
sudo ood config --set gid ood
sudo chown -R root:ood /etc/ood
sudo usermod -aG ood yourusername
sudo usermod -aG ood anotherusername
```
The new group will only apply to new sessions.

## Notes for specific operating systems
### Debian
You might have to intall curl to install node.js using the command above.
```
sudo apt-get update && sudo apt-get install curl
```

