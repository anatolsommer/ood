_ood ()
{
  local cur cmdp cmdstr cmd arg i

  COMPREPLY=()
  cur=${COMP_WORDS[COMP_CWORD]}
  cmdp='@(init|start|stop|restart|scale|redirect|status|config|ssl|mod|log|help)'
  cmdstr='init start stop restart scale redirect status config ssl mod log help'


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
        if [ -n "$arg" ] && [[ $cur != -* ]] ; then
          case $arg in
            --script|-s)
              COMPREPLY=( $( compgen -W "$(ls *.js)" -- $cur ) );;
            --cwd|-d)
              compopt -o nospace;
              if [[ $cur == "" ]] ; then
                cur="/"
              fi
              COMPREPLY=( $( compgen -S "/" -d "$cur" ) );;
          esac
        else
          COMPREPLY=( $( compgen -W '--help --script --cwd --alias' -- $cur ) );
        fi
        ;;
      start|stop|restart|scale|status)
        COMPREPLY=( $( compgen -W "$(ood autocomplete app $cmd)" -- $cur ) );;
      config)
        if [ -n "$arg" ] && [[ $cur != -* ]] ; then
          case $arg in
            --app|-ga)
              COMPREPLY=( $( compgen -W "$(ood autocomplete app)" -- $cur ) );;
          esac
        else
          COMPREPLY=( $( compgen -W '--help --app --get --set --delete -ga' -- $cur ) );
        fi
        ;;
      ssl)
        if [ -n "$arg" ] && [[ $cur != -* ]] ; then
          case $arg in
            --import|-i)
              compopt -o nospace;
              COMPREPLY=( $( compgen -f "$cur" ) );;
            --auto|-a)
              COMPREPLY=( $( compgen -W "$(ood autocomplete app)" -- $cur ) );;
            --delete-ca)
              COMPREPLY=( $( compgen -W "$(ood autocomplete ssl ca)" -- $cur ) );;
            --delete)
              COMPREPLY=( $( compgen -W "$(ood autocomplete ssl cert)" -- $cur ) );;
          esac
        else
          COMPREPLY=( $( compgen -W '--help --import --auto --email --agree --delete --delete-ca --list' -- $cur ) );
        fi
        ;;
      mod)
        if [ -n "$arg" ] && [[ $cur != -* ]] ; then
          case $arg in
            --enable|-e|--disable|-d)
              COMPREPLY=( $( compgen -W "$(ood autocomplete mod _$arg)" -- $cur ) );;
          esac
        else
          COMPREPLY=( $( compgen -W '--help --enable --disable --install' -- $cur ) );
        fi
        ;;
      help)
        COMPREPLY=( $( compgen -W "$cmdstr" -- $cur ) );;
    esac
    return 0;
  fi

  case "$cur" in
    -*)
      COMPREPLY=( $( compgen -W '-h --help' -- $cur ) );;
    *)
      COMPREPLY=( $( compgen -W "$cmdstr" -- $cur ) );;
  esac
}

complete -F _ood ood
