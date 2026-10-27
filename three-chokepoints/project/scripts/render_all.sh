cd /tmp/claude-0/-home-user-parthgg/f9f19970-75ec-55d4-9368-cfa3542c288d/scratchpad/doc
r(){ PAGE=$1 EXTRA="&shot=$2&region=$3" $ALPHA_ENV node scripts/render.mjs /tmp/claude-0/-home-user-parthgg/f9f19970-75ec-55d4-9368-cfa3542c288d/scratchpad/doc/clips/$2 25 $4 $5 1920 1080 > logs/$2.log 2>&1; echo "$2 $(ls clips/$2 | wc -l) $(grep -h 'frames ' logs/$2.log)"; }
mkdir -p clips logs
( r doc.html W1 world 5.5 15.12; r doc.html W2 world 52.68 58.52; r doc.html W3 world 77.68 89.6 ) &
( r doc.html H hormuz 14.88 35.52 ) &
( r doc.html B bab 35.28 52.92 ) &
( r doc.html M1 mal 58.28 66.92; r doc.html M2 mal 70.76 77.92; ALPHA_ENV="ALPHA=1" PAGE=hud.html EXTRA="&shot=F1&region=world" ALPHA=1 node scripts/render.mjs /tmp/claude-0/-home-user-parthgg/f9f19970-75ec-55d4-9368-cfa3542c288d/scratchpad/doc/clips/F1 25 66.68 71.0 1920 1080 > logs/F1.log 2>&1; echo "F1 $(ls clips/F1 | wc -l)" ) &
wait
echo ALLDONE
