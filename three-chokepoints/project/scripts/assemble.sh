set -e
C=/tmp/claude-0/-home-user-parthgg/f9f19970-75ec-55d4-9368-cfa3542c288d/scratchpad/doc; D=/home/user/parthgg/three-chokepoints; mkdir -p $D; cd $C
fr(){ printf "%05d" $(python3 -c "print(round($1*25))"); }
# F1 = real footage + transparent counter overlay (global 66.68..71.0)
ffmpeg -v error -y -i F1base.mp4 -framerate 25 -start_number $(fr 66.68) -i clips/F1/f_%05d.png -filter_complex "[0:v]trim=duration=4.32,setpts=PTS-STARTPTS[a];[a][1:v]overlay=format=auto,format=yuv420p[v]" -map "[v]" -c:v libx264 -crf 14 F1.mp4
# segments in order: (input, global start of its first frame); cuts with 0.2 s crossfades centred on each cut
ffmpeg -v error -y \
 -i F0.mp4 \
 -framerate 25 -start_number $(fr 5.5) -i clips/W1/f_%05d.png \
 -framerate 25 -start_number $(fr 14.88) -i clips/H/f_%05d.png \
 -framerate 25 -start_number $(fr 35.28) -i clips/B/f_%05d.png \
 -framerate 25 -start_number $(fr 52.68) -i clips/W2/f_%05d.png \
 -framerate 25 -start_number $(fr 58.28) -i clips/M1/f_%05d.png \
 -i F1.mp4 \
 -framerate 25 -start_number $(fr 70.76) -i clips/M2/f_%05d.png \
 -framerate 25 -start_number $(fr 77.68) -i clips/W3/f_%05d.png \
 -i audio/mix.wav \
 -filter_complex "
 [0]settb=AVTB,fps=25,format=yuv420p,trim=0:5.7,setpts=PTS-STARTPTS[s0];
 [1]settb=AVTB,fps=25,format=yuv420p,trim=0:9.6,setpts=PTS-STARTPTS[s1];
 [2]settb=AVTB,fps=25,format=yuv420p,trim=0:20.62,setpts=PTS-STARTPTS[s2];
 [3]settb=AVTB,fps=25,format=yuv420p,trim=0:17.62,setpts=PTS-STARTPTS[s3];
 [4]settb=AVTB,fps=25,format=yuv420p,trim=0:5.82,setpts=PTS-STARTPTS[s4];
 [5]settb=AVTB,fps=25,format=yuv420p,trim=0:8.62,setpts=PTS-STARTPTS[s5];
 [6]settb=AVTB,fps=25,format=yuv420p,trim=0:4.32,setpts=PTS-STARTPTS[s6];
 [7]settb=AVTB,fps=25,format=yuv420p,trim=0:7.14,setpts=PTS-STARTPTS[s7];
 [8]settb=AVTB,fps=25,format=yuv420p,setpts=PTS-STARTPTS[s8];
 [s0][s1]xfade=transition=fade:duration=0.2:offset=5.5[x1];
 [x1][s2]xfade=transition=fade:duration=0.2:offset=14.9[x2];
 [x2][s3]xfade=transition=fade:duration=0.2:offset=35.3[x3];
 [x3][s4]xfade=transition=fade:duration=0.2:offset=52.7[x4];
 [x4][s5]xfade=transition=fade:duration=0.2:offset=58.3[x5];
 [x5][s6]xfade=transition=fade:duration=0.2:offset=66.7[x6];
 [x6][s7]xfade=transition=fade:duration=0.2:offset=70.8[x7];
 [x7][s8]xfade=transition=fade:duration=0.2:offset=77.7,noise=alls=2:allf=t+u,format=yuv420p[v]" \
 -map "[v]" -map 9:a -c:v libx264 -preset slow -crf 19 -maxrate 14M -bufsize 28M -profile:v high -movflags +faststart -c:a aac -b:a 192k -shortest $D/three_chokepoints_16x9.mp4
ffprobe -v error -show_entries format=duration,size -of compact $D/three_chokepoints_16x9.mp4
ffmpeg -v error -y -i $D/three_chokepoints_16x9.mp4 -vf "fps=1/2,scale=320:-1,tile=6x8" $C/final_contact.jpg
echo ASSEMBLED
