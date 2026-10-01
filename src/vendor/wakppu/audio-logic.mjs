// Ported unchanged from etc/WaxStudio-Web.zip (see public/licenses/WAXSTUDIO-NOTICE.md).
// Recorded-only path from WaxCrackleAudio.cs. Unity exports the exact PCM grains.
const clamp=x=>Math.max(0,Math.min(1,x)),lerp=(a,b,t)=>a+(b-a)*clamp(t);
export class UnityRandom {
  constructor(seed=40817){
    const a=this.a=new Array(56).fill(0);let mj=161803398-Math.abs(seed),mk=1;a[55]=mj;
    for(let i=1;i<55;i++){const ii=21*i%55;a[ii]=mk;mk=mj-mk;if(mk<0)mk+=2147483647;mj=a[ii];}
    for(let k=0;k<4;k++)for(let i=1;i<56;i++){a[i]-=a[1+(i+30)%55];if(a[i]<0)a[i]+=2147483647;}
    this.i=0;this.j=21;
  }
  sample(){if(++this.i>=56)this.i=1;if(++this.j>=56)this.j=1;let v=this.a[this.i]-this.a[this.j];if(v===2147483647)v--;if(v<0)v+=2147483647;this.a[this.i]=v;return v/2147483647;}
  next(count){return Math.floor(this.sample()*count);}
}
export class UnityWaxAudioLogic {
  constructor(bank,emit){
    this.bank=bank;this.emit=emit;this.random=new UnityRandom();this.ends=new Array(16).fill(0);this.gains=new Array(16).fill(0);
    this.lastGrain=this.lastCrackVariant=this.lastPeelVariant=-1;this.lastCrackTime=this.lastProgressInputTime=-10;
    this.nextCrackTime=this.nextPeelTime=this.nextProgressTime=this.recordedVoiceEndTime=0;this.pendingProgress=this.pendingIntensity=0;
  }
  variant(key){this[key]=this[key]<0?this.random.next(6):(this[key]+1+this.random.next(5))%6;return this[key];}
  reserve(requested,now,duration){
    let active=0,free=-1;
    for(let i=0;i<16;i++){if(this.ends[i]<=now){this.gains[i]=0;if(free<0)free=i;}active+=this.gains[i];}
    const gain=Math.min(Math.max(0,requested),Math.max(0,.72-active));if(free<0||gain<.012)return 0;
    this.gains[free]=gain;this.ends[free]=now+duration;return gain;
  }
  limited(index,gain,now){
    if(index===undefined||now<this.recordedVoiceEndTime)return;
    const clip=this.bank.clips[index],duration=clip.frames/clip.sampleRate,actual=this.reserve(gain,now,duration);
    if(actual<=0)return;this.emit(index,actual);this.recordedVoiceEndTime=now+duration;
  }
  crack(intensity,volume,now){
    if(volume<=0||now<this.nextCrackTime)return;intensity=clamp(intensity);
    this.variant('lastCrackVariant'); // Unity evaluates its fallback argument even with recordings.
    const index=this.bank.cracks[this.random.next(this.bank.cracks.length)];
    const spacing=lerp(.72,1,(now-this.lastCrackTime-.05)/.11);
    this.limited(index,lerp(.24,.46,intensity)*spacing*(.92+.10*this.random.sample())*clamp(volume),now);
    this.lastCrackTime=now;this.nextCrackTime=now+.035;
  }
  peel(intensity,volume,now){
    if(volume<=0||now<this.nextPeelTime)return;this.variant('lastPeelVariant');
    // Actual prefab: recordedOnly=true and an empty peel bank.
    if(this.bank.peels.length)this.limited(this.bank.peels[this.random.next(this.bank.peels.length)],lerp(.05,.14,intensity)*clamp(volume),now);
    this.nextPeelTime=now+.10;
  }
  progress(intensity,delta,volume,now){
    if(volume<=0||delta<=.00001)return;
    if(now-this.lastProgressInputTime>.12)this.pendingProgress=this.pendingIntensity=0;
    this.lastProgressInputTime=now;this.pendingProgress=clamp(this.pendingProgress+delta);this.pendingIntensity=Math.max(this.pendingIntensity,clamp(intensity));
    if(now<this.nextProgressTime)return;
    const activity=Math.sqrt(clamp(this.pendingProgress/.045)),strength=this.pendingIntensity;
    if(now>=this.recordedVoiceEndTime&&this.gains.filter((g,i)=>g>0&&this.ends[i]>now).length<3&&this.bank.progress.length){
      const count=this.bank.progress.length;this.lastGrain=count<2?0:this.lastGrain<0?this.random.next(count):(this.lastGrain+1+this.random.next(count-1))%count;
      const index=this.bank.progress[this.lastGrain],clip=this.bank.clips[index];
      const requested=lerp(1.6,2.8,strength)*lerp(.60,1,activity)*clamp(volume);
      const cost=this.reserve(requested*clip.peak,now,clip.frames/clip.sampleRate);
      if(cost>0)this.emit(index,cost/clip.peak);
    }
    this.nextProgressTime=now+lerp(.075,.055,strength);this.pendingProgress=this.pendingIntensity=0;
  }
}
