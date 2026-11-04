cd /tmp/claude-0/-home-user-parthgg/f9f19970-75ec-55d4-9368-cfa3542c288d/scratchpad/doc
r(){ PAGE=hero.html EXTRA="&shot=$1&region=$2" node scripts/render.mjs $PWD/hero/$1 25 $3 $4 1080 1920 > logs/hero_$1.log 2>&1; echo "$1 $(ls hero/$1 | wc -l) $(grep -h 'frames ' logs/hero_$1.log)"; }
( r A world 0.0 5.7; r G mal 26.95 30.5 ) &
( r D hormuz 10.4 17.05; r I world 31.8 34.2 ) &
( r E bab 17.05 22.7; r F world 22.7 26.95 ) &
( r B hormuz 5.7 9.25; r K world 34.75 38.6; r L world 38.6 41.5 ) &
wait; echo HERODONE
