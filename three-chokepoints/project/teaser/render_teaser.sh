cd /tmp/claude-0/-home-user-parthgg/f9f19970-75ec-55d4-9368-cfa3542c288d/scratchpad/doc
until grep -q DWDONE logs/render_dw.log; do sleep 5; done
r(){ PAGE=teaser.html EXTRA="" node scripts/render.mjs $PWD/tz/OUT 25 $1 $2 1920 1080 > logs/teaser_$1.log 2>&1; echo "$1 $(grep -h 'frames ' logs/teaser_$1.log)"; }
( r 0 3.0 ) & ( r 3.0 7.0 ) & ( r 7.0 11.0 ) & ( r 11.0 15.0 ) &
wait
n=$(ls tz/OUT | wc -l); echo "frames $n"
ffmpeg -v error -y -framerate 25 -i tz/OUT/f_%05d.png -i audio/teaser_mix.wav -vf "noise=alls=4:allf=t,format=yuv420p" -c:v libx264 -preset slow -crf 17 -profile:v high -movflags +faststart -c:a aac -b:a 256k -t 15 /home/user/parthgg/three-chokepoints/teaser_15s_16x9.mp4
ffprobe -v error -show_entries format=duration,size -of compact /home/user/parthgg/three-chokepoints/teaser_15s_16x9.mp4
echo TEASERDONE
