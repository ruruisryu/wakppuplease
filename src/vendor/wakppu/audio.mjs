// Ported from etc/WaxStudio-Web.zip src/audio.mjs (see public/licenses/WAXSTUDIO-NOTICE.md).
// v0.4: shares the game's AudioContext/bus (volume and mute come from the game mixer), load retry, no own suspend.
import {UnityWaxAudioLogic} from './audio-logic.mjs';
export class CrackAudio {
  constructor(){
    this.enabled=true;this.volume=1;this.voices=new Set();this.events=0;this.loaded=false;this.states=new Map();this.model='Butter';this.sweeping=false;this.nextBrush=this.nextDebris=0;this.eventKinds={};
    this.preload=this.fetchBank();
  }
  fetchBank(){
    this.loadError=null;
    return Promise.all([
      fetch('./assets/audio/unity-audio.json').then(r=>{if(!r.ok)throw Error('Unity audio bank unavailable');return r.json();}),
      fetch('./assets/audio/unity-pcm.bin').then(r=>{if(!r.ok)throw Error('Unity audio PCM unavailable');return r.arrayBuffer();})
    ]).catch(error=>{this.loadError=error;return null;});
  }
  /** v0.4: retries a failed PCM/bank download. */
  retry(){if(this.loaded||!this.context)return this.loadPromise;this.preload=this.fetchBank();this.loadPromise=this.preload.then(data=>this.decode(data));return this.loadPromise;}
  /** v0.4: attaches to the game's context and output bus (called from a user gesture). */
  async attach(context,output){
    if(!this.context){
      this.context=context;this.master=this.context.createGain();this.master.gain.value=this.enabled?1:0;this.master.connect(output);
      this.filter=this.context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=3600;
      // Web Audio expresses low-pass Q in dB; Unity resonance Q=1 maps to 0 dB.
      this.filter.Q.value=0;this.filter.connect(this.master);
      this.loadPromise=this.preload.then(data=>this.decode(data));
    }
    await this.loadPromise;
  }
  decode(data){
        if(!data)return;const [bank,bytes]=data;this.bank=bank;
        this.buffers=bank.clips.map(clip=>{
          const buffer=this.context.createBuffer(clip.channels,clip.frames,clip.sampleRate),pcm=new DataView(bytes,clip.offset,clip.frames*clip.channels*4);
          for(let c=0;c<clip.channels;c++){const channel=buffer.getChannelData(c);for(let f=0;f<clip.frames;f++)channel[f]=pcm.getFloat32((f*clip.channels+c)*4,true);}
          return buffer;
        });this.loaded=true;this.select(this.model);
  }
  select(id){this.model=id;if(!this.loaded)return;if(!this.states.has(id))this.states.set(id,new UnityWaxAudioLogic(this.bank,(index,gain)=>this.play(index,gain)));this.logic=this.states.get(id);}
  play(index,gain,broom=false){
    if(!this.loaded||!this.enabled||this.context.state!=='running')return;
    const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=this.buffers[index];source.playbackRate.value=1;level.gain.value=gain;
    source.connect(level).connect(broom?this.master:this.filter);source.broom=broom;this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();level.disconnect();};source.start();this.events++;
    const kind=this.bank.clips[index].kind;this.eventKinds[kind]=(this.eventKinds[kind]||0)+1;
  }
  setEnabled(enabled){this.enabled=enabled;if(this.master)this.master.gain.value=enabled?1:0;}
  available(){return this.loaded&&this.enabled&&this.context.state==='running';}
  crack(intensity=1){if(this.available())this.logic.crack(intensity,this.volume,this.context.currentTime);}
  progress(intensity,delta){if(this.available())this.logic.progress(intensity,delta,this.volume,this.context.currentTime);}
  peel(intensity){if(this.available())this.logic.peel(intensity,this.volume,this.context.currentTime);}
  beginSweep(){this.sweeping=true;this.nextBrush=this.context?.currentTime||0;this.update();}
  endSweep(stop=false){this.sweeping=false;if(stop)for(const source of this.voices)if(source.broom)source.stop();}
  update(){if(!this.sweeping||!this.available())return;const now=this.context.currentTime;if(now>=this.nextBrush){this.play(this.bank.brush,.34,true);this.nextBrush=now+.48;}}
  swept(moved){if(!moved||!this.available())return;const now=this.context.currentTime;if(now>=this.nextDebris){this.play(this.bank.debris,.34*Math.min(1,.5+moved*.08),true);this.nextDebris=now+.11;}}
  suspend(){this.endSweep(true);}
  stopAll(){for(const source of this.voices){try{source.stop();}catch{}}}
}
