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
  * added tutorial

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

