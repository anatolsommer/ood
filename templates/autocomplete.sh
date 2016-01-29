_ood ()
{
  local cur cmdp cmdstr special i

  COMPREPLY=()
  cur=${COMP_WORDS[COMP_CWORD]}
  cmdp='@(init|start|stop|restart|scale|redirect|status|config|ssl|log|help|--app|-ga)'
  cmdstr='init start stop restart scale redirect status config ssl log help'

  for (( i=0; i < ${#COMP_WORDS[@]}-1; i++ )); do
    if [[ ${COMP_WORDS[i]} == $cmdp ]]; then
      special=${COMP_WORDS[i]}
    fi
  done

  if [ -n "$special" ]; then
    case $special in
      init)
        COMPREPLY=( $( compgen -W '--help --script --cwd --alias' -- $cur ) );;
      start|stop|restart|scale|status)
        COMPREPLY=( $( compgen -W "$(ood autocomplete app $special)" -- $cur ) );;
      config)
        COMPREPLY=( $( compgen -W '--help --app --get --set --delete -ga' -- $cur ) );;
      --app|-ga)
        COMPREPLY=( $( compgen -W "$(ood autocomplete app)" -- $cur ) );;
    esac
    return 0
  fi

  case "$cur" in
    -*)
      COMPREPLY=( $( compgen -W '-h --help' -- $cur ) );;
    *)
      COMPREPLY=( $( compgen -W "$cmdstr" -- $cur ) );;
  esac

  return 0
}

complete -F _ood ood
