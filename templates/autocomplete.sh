_ood ()
{
  local cur cmdp cmdstr cmd arg i

  COMPREPLY=()
  cur=${COMP_WORDS[COMP_CWORD]}
  cmdp='@(init|start|stop|restart|scale|redirect|status|config|ssl|log|help)'
  cmdstr='init start stop restart scale redirect status config ssl log help'


  for (( i=0; i < ${#COMP_WORDS[@]}-1; i++ )); do
    if [[ ${COMP_WORDS[i]} == $cmdp ]]; then
      cmd=${COMP_WORDS[i]}
    fi
    if [[ ${COMP_WORDS[i]} == -* ]]; then
      arg=${COMP_WORDS[i]}
    fi
  done

  if [ -n "$cmd" ]; then
    case $cmd in
      init)
        COMPREPLY=( $( compgen -W '--help --script --cwd --alias' -- $cur ) );;
      start|stop|restart|scale|status)
        COMPREPLY=( $( compgen -W "$(ood autocomplete app $cmd)" -- $cur ) );;
      config)
        if [ -n "$arg" ] && [[ $cur != -* ]] ; then
          case $arg in
            --app|-ga)
              COMPREPLY=( $( compgen -W "$(ood autocomplete app)" -- $cur ) );
              return 0
          esac
        fi
        COMPREPLY=( $( compgen -W '--help --app --get --set --delete -ga' -- $cur ) );;
      ssl)
        COMPREPLY=( $( compgen -W '--help --auto --email --agree --delete --delete-ca --list -l' -- $cur ) );;
      help)
        COMPREPLY=( $( compgen -W "$cmdstr" -- $cur ) );;
    esac
    return 0
  fi

  case "$cur" in
    -*)
      COMPREPLY=( $( compgen -W '-h --help' -- $cur ) );;
    *)
      COMPREPLY=( $( compgen -W "$cmdstr" -- $cur ) );;
  esac
}

complete -F _ood ood
