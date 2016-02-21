1.0.0-rc1 / 2016-02-21
======================

  * logrotate
  * improved logging
  * improved installer

0.7.4-beta / 2016-02-19
=======================

  * improved CLI
  * improved autocomplete

0.7.3-beta / 2016-02-18
=======================

  * improved logging
  * access logs for apps and modules
  * load modules without proxy restart

0.7.2-beta / 2016-02-17
=======================

  * bugfixes

0.7.1-beta / 2016-02-17
=======================

  * wildcard certificate support
  * bugfixing (cert chain)

0.7.0-beta / 2016-02-14
=======================

  * module system
    * added `ood mod` command
    * moved load-balancer probe to "ood-loadbalancer"
    * moved monitoring sensor to "ood-monitoring"
  * completed API client
  * reusing ports
  * bugfixes

0.6.4-alpha / 2016-02-12
========================

  * load-balancer probe
  * monitoring sensor
  * improved API

0.6.3-alpha / 2016-02-11
========================

  * improved CLI
    * delete certificates
    * delete CA certificates
  * improved autocomplete
    * source autocomplete using `. <(ood autocomplete)`
    * suggest CN or CA hash for ssl --delete/--delete-ca

0.6.2-alpha / 2016-02-09
========================

  * improved autocomplete
  * fixed tests
  * updated dependencies

0.6.1-alpha / 2016-02-08
========================

  * started to implement tests

0.6.0-alpha / 2016-02-07
========================

  * logging for apps
  * ood log --filter
  * CLI refactoring
  * code improvements
  * added tutorial "Getting started"

0.5.0-alpha / 2016-02-05
========================

  * CLI improvements
    * autocomplete (with intelligent app name suggestions)
    * better status output on start/restart/stop/scale
    * starting apps on init
    * add http:// to redirect target if not present
  * container state (starting, running, ...)
    * handle crashing apps
    * try to resurrect crashed apps
  * update proxy on alias change
  * bugfixes

0.4.1-alpha / 2016-01-31
========================

  * ssl --auto (Let's Encrypt)
    * get free certificates
    * multidomain (from alias)
    * automatic renewal (14 days before expiration)
  * bugfixes

0.4.0-alpha / 2016-01-29
========================

  * basic https support with SNI
    * added ssl command
    * added certMgr
  * bugfixes and code improvements

0.3.1-alpha / 2016-01-25
========================

  * no more binary dependencies
  * manual garbage collection in appContainer
  * adaptions for CentOS
  * bugfixes

0.3.0-alpha / 2016-01-24
========================

  * redirects (http->https, com->org, strip www, etc.)
  * applying config changes without restarting
    * broadcasting changes to proxy workers
    * restarting proxy workers if ports have changed
    * changing GID and logLevel of odd brain instantly
  * bugfixes and code improvements

0.2.3-alpha / 2016-01-23
========================

  * improved documentation and tutorial
  * improved install script (systemd)
  * using teselecta for colored ood config

0.2.2-alpha / 2016-01-22
========================

  * improved install script
  * updated dependencies
  * small code improvements
  * added tutorial "Installing ood"

0.2.1-alpha / 2016-01-22
========================

  * housekeeping (.gitignore, jshint, deps)

0.2.0-alpha / 2016-01-22
========================

  * basic reverse proxy
  * converting config values to correct type
  * added --alias option for ood init
  * improved install script

0.1.0-alpha / 2016-01-18
========================

  * initial release

