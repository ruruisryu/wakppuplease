// Ported from etc/WaxStudio-Web.zip src/simulation.mjs (see public/licenses/WAXSTUDIO-NOTICE.md).
// v0.4.0 changes are marked `v0.4:`: npm three import, tool reach/depth, cracked-area ledger input, loose-piece pruning.
import * as THREE from 'three';
import {area,centroid,normal,fracture,shellArrays,unpackSurface,random,canSplit} from './geometry.mjs';
// v0.4: coating recipes and tools are unlocked by research; free tuning is a dev-only panel.
export const DEFAULT_TOOL={reach:.85,operations:3,detachReach:.78,depth:1};
export const PRESETS={soft:{brittleness:92,thickness:20,softness:85,adhesion:25},classic:{brittleness:72,thickness:30,softness:65,adhesion:45},hard:{brittleness:30,thickness:45,softness:35,adhesion:72}};
// Models share a 3.15-unit maximum dimension. Both limits reject long, thin shards.
export const SWEEP_LIMITS={maxArea:.22,maxDiameter:.8};
export function canSweepAttached(piece){
  return piece.alive&&!piece.detached&&piece.damaged&&piece.area<=SWEEP_LIMITS.maxArea&&piece.mesh.geometry.boundingBox.getSize(new THREE.Vector3()).length()<=SWEEP_LIMITS.maxDiameter;
}
const UP=new THREE.Vector3(0,1,0),tmp=new THREE.Vector3();
export class WaxSimulation {
  constructor(scene,audio){
    this.scene=scene;this.audio=audio;this.models=new Map();this.current=null;this.settings={...PRESETS.classic};this.tool={...DEFAULT_TOOL};this.gesture=null;this.serial=0;this.rng=random(419);
    this.wax=new THREE.MeshPhysicalMaterial({color:0xf4f0dd,roughness:.44,metalness:0,clearcoat:.13,clearcoatRoughness:.5,side:THREE.DoubleSide});
    this.inside=new THREE.MeshStandardMaterial({color:0xe8e2cc,roughness:.77,side:THREE.DoubleSide});
    this.onchange=()=>{};this.onfracture=()=>{};
  }
  addModel(data){
    if(this.models.has(data.id))return this.models.get(data.id);
    const core=data.meshes.find(m=>m.mainCore)||data.meshes.find(m=>m.kind==='core');
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<core.positions.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],core.positions[i+j]);max[j]=Math.max(max[j],core.positions[i+j]);}
    const centre=min.map((v,j)=>(v+max[j])*.5),size=max.map((v,j)=>v-min[j]),scale=3.15/Math.max(...size);
    const model={id:data.id,group:new THREE.Group(),cores:[],pieces:[],originals:[],height:size[1]*scale,coreSize:new THREE.Vector3(...size.map(v=>v*scale)),fractures:0,rebreaks:0,removedArea:0,crackedArea:0,cleared:0,pressure:0,contact:new THREE.Vector3(),inward:new THREE.Vector3(0,-1,0),totalArea:0};
    model.group.position.y=model.height*.5+.1;model.group.rotation.set(0,-.30,0);model.group.visible=false;this.scene.add(model.group);
    for(const mesh of data.meshes){
      if(mesh.kind==='wax'){
        const surface=unpackSurface(mesh,centre,scale);model.originals.push(surface);
        const piece=this.createPiece(surface,0,0);model.pieces.push(piece);model.group.add(piece.mesh);model.totalArea+=piece.area;
      }else{
        const geometry=new THREE.BufferGeometry(),positions=mesh.positions.map((v,i)=>(v-centre[i%3])*scale);
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals,3));geometry.setIndex(mesh.indices);geometry.computeBoundingSphere();
        const color=new THREE.Color(...mesh.color); // Unity exported pigment components are authored sRGB.
        color.convertSRGBToLinear();
        const material=new THREE.MeshPhysicalMaterial({color,roughness:.36,metalness:0,clearcoat:.25,clearcoatRoughness:.43});
        const object=new THREE.Mesh(geometry,material);object.castShadow=true;object.receiveShadow=true;object.userData.core=true;
        model.cores.push({mesh:object,rest:new Float32Array(positions),normals:new Float32Array(mesh.normals)});model.group.add(object);
      }
    }
    this.models.set(data.id,model);return model;
  }
  select(id){
    this.endPress();for(const model of this.models.values()){model.group.visible=model.id===id;for(const p of model.pieces)if(p.detached)p.mesh.visible=model.id===id;}
    this.current=this.models.get(id);this.audio.select?.(id);this.onchange();return this.current;
  }
  createPiece(surface,generation,born){
    const arrays=shellArrays(surface,this.settings.thickness/1000),geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(arrays.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(arrays.normals,3));
    geometry.addGroup(0,arrays.outerCount,0);geometry.addGroup(arrays.outerCount,arrays.positions.length/3-arrays.outerCount,1);geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const mesh=new THREE.Mesh(geometry,[this.wax,this.inside]);mesh.position.fromArray(arrays.centre);mesh.castShadow=true;mesh.receiveShadow=true;
    const c=new THREE.Vector3(...arrays.centre),n=new THREE.Vector3(...normal(surface));
    const piece={mesh,surface,centre:c,normal:n,generation,born,area:area(surface),damaged:generation>0,detached:false,alive:true,offset:new THREE.Vector3(),velocity:new THREE.Vector3(),angular:new THREE.Vector3(),age:0,sleeping:false,releaseAt:.55+this.rng()*.32};
    mesh.userData.piece=piece;return piece;
  }
  pick(raycaster){
    const m=this.current;if(!m)return null;m.group.updateMatrixWorld(true);
    const hits=raycaster.intersectObjects([...m.pieces.filter(p=>p.alive).map(p=>p.mesh),...m.cores.map(c=>c.mesh)],false);
    if(!hits.length)return null;
    const hit=hits[0],piece=hit.object.userData.piece;
    const local=m.group.worldToLocal(hit.point.clone());
    const n=hit.normal?hit.normal.clone():hit.face.normal.clone();n.transformDirection(hit.object.matrixWorld);
    // The ray-facing side is the press surface, including a fragment's underside.
    if(n.dot(raycaster.ray.direction)>0)n.negate();
    const inward=n.negate().transformDirection(m.group.matrixWorld.clone().invert());
    if(piece&&!piece.detached){local.sub(piece.offset);}
    return{hit,piece,local,inward};
  }
  beginPress(pick){
    this.endPress();if(!pick||!this.current)return false;
    this.gesture={serial:++this.serial,pick,time:0,pressure:0,operations:0,lastSplit:-1,done:false,detached:!!pick.piece?.detached};
    if(!this.gesture.detached){this.current.contact.copy(pick.local);this.current.inward.copy(pick.inward);}return true;
  }
  movePress(pick){
    if(!pick||!this.gesture||this.gesture.detached||pick.piece?.detached)return;
    const g=this.gesture;
    if(pick.local.distanceTo(g.pick.local)>.16){g.pick=pick;g.operations=0;g.done=false;this.current.contact.copy(pick.local);this.current.inward.copy(pick.inward);}
  }
  endPress(){this.gesture=null;}
  split(piece){
    const m=this.current,g=this.gesture;if(!g||!piece.alive||!canSplit(piece,m.pieces.length))return false;
    const surfaces=fracture(piece.surface,this.rng,2);if(surfaces.length<2)return false;
    const children=surfaces.map(s=>this.createPiece(s,piece.generation+1,g.serial));
    piece.mesh.updateMatrixWorld(true);
    for(const child of children){
      child.damaged=true;child.offset.copy(piece.offset);child.mesh.quaternion.copy(piece.mesh.quaternion);
      if(piece.detached){
        child.detached=true;child.mesh.position.copy(child.centre).sub(piece.centre).applyQuaternion(piece.mesh.quaternion).add(piece.mesh.position);
        child.velocity.copy(piece.velocity);child.velocity.x+=(this.rng()-.5)*.12;child.velocity.z+=(this.rng()-.5)*.12;child.velocity.y=.07;
        child.angular.set((this.rng()-.5)*1.3,0,(this.rng()-.5)*1.3);this.scene.add(child.mesh);
      }else{
        // A small lateral opening exposes actual filling; there is no backing shell.
        const away=child.centre.clone().sub(piece.centre);away.addScaledVector(piece.normal,-away.dot(piece.normal)).normalize();
        child.offset.addScaledVector(away,.006+this.rng()*.009).addScaledVector(child.normal,.01);
        child.mesh.position.copy(child.centre).add(child.offset);m.group.add(child.mesh);
      }
    }
    piece.alive=false;piece.mesh.removeFromParent();piece.mesh.geometry.dispose();m.pieces=m.pieces.filter(p=>p!==piece);m.pieces.push(...children);
    m.fractures++;if(piece.generation>0||piece.detached)m.rebreaks++;
    // v0.4: first crack of an attached original plate counts its whole (area-normalised) surface once.
    if(!piece.detached&&piece.generation===0)m.crackedArea+=piece.area;
    if(piece.detached)this.audio.crack?.(1);
    else m.soundProgress=(m.soundProgress||0)+Math.min(1,piece.area/(.85*.85));
    this.onfracture();this.onchange();return true;
  }
  detach(piece,playSound=true){
    const m=this.current;if(piece.detached||!piece.alive)return;
    m.group.updateMatrixWorld(true);this.scene.attach(piece.mesh);piece.detached=true;piece.age=0;
    const outward=piece.normal.clone().transformDirection(m.group.matrixWorld);
    // Gentle outward drift clears the filling. Gravity carries the chip to the table.
    piece.velocity.set(outward.x*.4,-.05,outward.z*.4);piece.angular.set((this.rng()-.5)*3,(this.rng()-.5)*2,(this.rng()-.5)*3);
    m.removedArea+=piece.area;if(playSound)this.audio.peel?.(1);this.onchange();
  }
  update(dt){
    const m=this.current;if(!m)return;dt=Math.max(0,Math.min(dt,.1));
    if(m.pieces.length>300)this.prune(280);
    const g=this.gesture;
    if(g){
      g.time+=dt;g.pressure=Math.min(1,.08+g.time/.92);
      const threshold=(.20+(1-this.settings.brittleness/100)*.52)*(1+Math.max(0,this.settings.thickness-30)/100);
      if(g.detached){
        if(!g.done&&g.pressure>threshold){if(g.pick.piece.alive)this.split(g.pick.piece);g.done=true;}
      }else{
        const depth=(.18+this.settings.softness/100*.45)*g.pressure*this.tool.depth;
        m.pressure+=(depth-m.pressure)*Math.min(1,dt*12);
        if(g.pressure>threshold&&g.time-g.lastSplit>.075&&g.operations<this.tool.operations){
          const candidates=m.pieces.filter(p=>!p.detached&&p.born!==g.serial&&p.centre.distanceTo(m.contact)<this.tool.reach&&p.normal.dot(m.inward)<.45&&canSplit(p,m.pieces.length));
          // The captured surface wins even when a broad plate's centroid is remote.
          if(g.pick.piece?.alive&&g.pick.piece.born!==g.serial&&!candidates.includes(g.pick.piece)&&canSplit(g.pick.piece,m.pieces.length))candidates.unshift(g.pick.piece);
          candidates.sort((a,b)=>a.centre.distanceToSquared(m.contact)-b.centre.distanceToSquared(m.contact));
          if(candidates.length&&this.split(candidates[0])){g.operations++;g.lastSplit=g.time;}
        }
        for(const p of m.pieces){
          if(p.detached||!p.damaged)continue;
          const d=p.centre.distanceTo(m.contact),adhesion=this.settings.adhesion/100;
          if(d<this.tool.detachReach && g.pressure>p.releaseAt*(.55+adhesion*.9) && g.time>.38 && (p.born===g.serial||g.pressure>.75)) this.detach(p);
        }
      }
    }else m.pressure*=Math.exp(-dt*(5-this.settings.softness/100*3));
    if(m.pressure<.0001)m.pressure=0;
    // Actual new surface changes drive sound; holding pressure without growth is silent.
    if(m.soundProgress>0){this.audio.progress?.(g?.pressure||0,m.soundProgress);m.soundProgress=0;}
    this.deform(m);
    for(const p of m.pieces){
      if(!p.detached){
        p.mesh.position.copy(p.centre).add(p.offset);
        if(m.pressure>0){const d=p.centre.distanceToSquared(m.contact),weight=Math.exp(-d/ .52);p.mesh.position.addScaledVector(m.inward,m.pressure*weight*(p.damaged?.82:.7));}
        continue;
      }
      if(p.sleeping)continue;
      p.age+=dt;p.velocity.y-=5.8*dt;p.mesh.position.addScaledVector(p.velocity,dt);
      p.mesh.rotateX(p.angular.x*dt);p.mesh.rotateY(p.angular.y*dt);p.mesh.rotateZ(p.angular.z*dt);
      // Ellipsoid proxy of the filling; fragment-fragment collisions are intentionally omitted.
      if(p.age<3){
        m.group.updateMatrixWorld();const local=m.group.worldToLocal(p.mesh.position.clone());
        const radii=m.coreSize.clone().multiplyScalar(.48),q=new THREE.Vector3(local.x/radii.x,local.y/radii.y,local.z/radii.z),len=q.length();
        if(len<1&&len>.001){q.multiplyScalar(1/len);const target=q.multiply(radii);const world=m.group.localToWorld(target);p.mesh.position.lerp(world,.45);}
      }
      const box=p.mesh.geometry.boundingBox;
      let bottom=Infinity;
      for(let i=0;i<8;i++){tmp.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyQuaternion(p.mesh.quaternion);bottom=Math.min(bottom,tmp.y+p.mesh.position.y);}
      if(bottom<.025){
        p.mesh.position.y+=.025-bottom;p.velocity.y=Math.abs(p.velocity.y)*.12;p.velocity.x*=.78;p.velocity.z*=.78;p.angular.multiplyScalar(.82);
        if(p.age>.45&&p.velocity.length()<.15){p.sleeping=true;p.velocity.set(0,0,0);p.angular.set(0,0,0);}
      }
      p.velocity.x*=Math.exp(-dt*.3);p.velocity.z*=Math.exp(-dt*.3);
    }
  }
  deform(m){
    if(m.lastDeformation===m.pressure&&!this.gesture)return;m.lastDeformation=m.pressure;
    const c=m.contact,n=m.inward,depth=m.pressure;
    for(const core of m.cores){
      const a=core.mesh.geometry.attributes.position.array,r=core.rest;
      for(let i=0;i<r.length;i+=3){const dx=r[i]-c.x,dy=r[i+1]-c.y,dz=r[i+2]-c.z;
        const w=Math.exp(-(dx*dx+dy*dy+dz*dz)/.62)*depth;
        a[i]=r[i]+n.x*w;a[i+1]=r[i+1]+n.y*w;a[i+2]=r[i+2]+n.z*w;
      }
      core.mesh.geometry.attributes.position.needsUpdate=true;
      // Conservative bounds include both the rest and compressed surface.
      if(!core.boundsExpanded){core.mesh.geometry.boundingSphere.radius+=1;core.boundsExpanded=true;}
    }
  }
  rotate(dx,dy){
    const m=this.current;if(!m)return;this.endPress();
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(dy,dx,0,'XYZ'));m.group.quaternion.premultiply(q);
    // Raise the object to keep rotated geometry above the tabletop.
    const box=new THREE.Box3();for(const c of m.cores)box.expandByObject(c.mesh);
    m.group.position.y+=.09-box.min.y;
  }
  clear(){const m=this.current;if(!m)return 0;this.endPress();const loose=m.pieces.filter(p=>p.detached);for(const p of loose){p.alive=false;p.mesh.removeFromParent();p.mesh.geometry.dispose();}m.pieces=m.pieces.filter(p=>!p.detached);m.cleared+=loose.length;this.onchange();return loose.length;}
  sweep(world,dx,dz,pick=null){
    const m=this.current;if(!m)return;
    if(Math.hypot(dx,dz)<.00001)return;
    // Use the visible surface hit, not its projection onto the floor: this also
    // works on rotated sides and never brushes through the filling to the back.
    if(pick&&!pick.piece?.detached){
      const p=pick.piece;if(!p||!canSweepAttached(p))return;
      this.detach(p,false);
      const motion=new THREE.Vector3(dx,0,dz).clampLength(0,.18);
      p.velocity.addScaledVector(motion,9);p.velocity.y=-.18;p.sleeping=false;
      this.audio.swept?.(1);this.onchange();return;
    }
    let moved=0;
    for(const p of m.pieces)if(p.detached){const d=Math.hypot(p.mesh.position.x-world.x,p.mesh.position.z-world.z);if(d<.85){p.sleeping=false;p.age=4;p.velocity.x+=dx*13+(p.mesh.position.x-world.x)*.4;p.velocity.z+=dz*13+(p.mesh.position.z-world.z)*.4;p.velocity.y=.14;p.angular.set(.5,1,.4);moved++;}}
    this.audio.swept?.(moved);
    const far=m.pieces.filter(p=>p.detached&&Math.hypot(p.mesh.position.x,p.mesh.position.z)>6);
    for(const p of far){p.alive=false;p.mesh.removeFromParent();p.mesh.geometry.dispose();}m.pieces=m.pieces.filter(p=>p.alive);m.cleared+=far.length;this.onchange();
  }
  reset(){
    const m=this.current;if(!m)return;this.endPress();for(const p of m.pieces){p.alive=false;p.mesh.removeFromParent();p.mesh.geometry.dispose();}
    m.pieces=m.originals.map(s=>this.createPiece(s,0,0));for(const p of m.pieces)m.group.add(p.mesh);
    m.pressure=0;m.soundProgress=0;m.lastDeformation=-1;m.removedArea=0;m.crackedArea=0;m.fractures=0;m.rebreaks=0;m.cleared=0;
    m.group.rotation.set(0,-.30,0);m.group.position.set(0,m.height*.5+.1,0);this.deform(m);this.onchange();
  }
  setSettings(settings){
    const old=this.settings.thickness;Object.assign(this.settings,settings);
    // Thickness changes rebuild only shell geometry, keeping pose and fracture state.
    if(old!==this.settings.thickness)for(const m of this.models.values())for(const p of m.pieces){const data=shellArrays(p.surface,this.settings.thickness/1000);p.mesh.geometry.dispose();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));geo.addGroup(0,data.outerCount,0);geo.addGroup(data.outerCount,data.positions.length/3-data.outerCount,1);geo.computeBoundingBox();geo.computeBoundingSphere();p.mesh.geometry=geo;}
  }
  // v0.4: removes the oldest resting loose chips so the 320-piece budget never silently blocks new cracks.
  prune(target){
    const m=this.current;if(!m)return 0;const loose=m.pieces.filter(p=>p.detached&&p.sleeping);let removed=0;
    for(const p of loose){if(m.pieces.length-removed<=target)break;p.alive=false;p.mesh.removeFromParent();p.mesh.geometry.dispose();removed++;}
    if(removed){m.pieces=m.pieces.filter(p=>p.alive);m.cleared+=removed;this.onchange();}return removed;
  }
  // v0.4: area-normalised work measure (independent of triangle count). Both parts only grow until reset().
  progress(){const m=this.current;if(!m)return{cracked:0,removed:0};return{cracked:Math.min(1,m.crackedArea/m.totalArea),removed:Math.min(1,m.removedArea/m.totalArea)};}
  stats(){const m=this.current;return m?{id:m.id,fractures:m.fractures,rebreaks:m.rebreaks,peeled:Math.min(100,Math.round(m.removedArea/m.totalArea*100)),pieces:m.pieces.length,loose:m.pieces.filter(p=>p.detached).length,cleared:m.cleared,pressure:m.pressure,gesture:this.gesture?.serial||0}:{id:null};}
}
