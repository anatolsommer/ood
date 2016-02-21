#!/bin/bash
# chkconfig: 2345 98 02
#
# description: ood process manager and reverse proxy
# processname: ood
#
### BEGIN INIT INFO
# Provides:       ood
# Required-Start: $local_fs $remote_fs
# Required-Stop:  $local_fs $remote_fs
# Should-Start:   $network
# Should-Stop:    $network
# Default-Start:  2 3 4 5
# Default-Stop:   0 1 6
# Short-Description: ood init script
# Description: ood process manager and reverse proxy
### END INIT INFO

NAME=ood
PIDFILE=/var/run/ood.pid

if [ $(id -u) != "0" ];
then
  echo "Must be run as root"
  exit 1
fi

start() {
    echo "Starting $NAME..."
    if [ -f $PIDFILE ];
    then
       echo "$NAME already running"
       exit 1
    else
      %NODE% %OOD% & echo $! > $PIDFILE
      RETVAL=$?
    fi
}

stop() {
    if [ -f $PIDFILE ];
    then
      echo "Stopping $NAME..."
      kill $(cat $PIDFILE)
      rm $PIDFILE
    else
       echo "$NAME not running"
    fi
}

restart() {
    stop
    sleep 3
    start
}

status() {
    ood status
    RETVAL=$?
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    reload)
        ;;
    force-reload)
        ;;
    *)
        echo "Usage: {start|stop|status|restart}"
        exit 1
        ;;
esac
exit $RETVAL
