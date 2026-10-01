// Ported unchanged from etc/WaxStudio-Web.zip (see public/licenses/WAXSTUDIO-NOTICE.md).
// Surface-preserving half-plane clipping. Each vertex is [x,y,z,nx,ny,nz].
// Cracks cross triangles instead of following the triangulation of the model.
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function unit(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l);}
export function area(triangles){let a=0;for(const t of triangles)a+=Math.hypot(...cross(sub(t[1],t[0]),sub(t[2],t[0])))*.5;return a;}
export function centroid(triangles){let total=0,c=[0,0,0];for(const t of triangles){const a=Math.hypot(...cross(sub(t[1],t[0]),sub(t[2],t[0])))*.5;total+=a;for(let j=0;j<3;j++)c[j]+=(t[0][j]+t[1][j]+t[2][j])*a/3;}return c.map(v=>v/(total||1));}
export function normal(triangles){const n=[0,0,0];for(const t of triangles)for(const v of t)for(let j=0;j<3;j++)n[j]+=v[j+3];return unit(n);}
export function random(seed=431){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
function clipPolygon(poly,n,offset,sign){
  const output=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=(dot(a,n)-offset)*sign,db=(dot(b,n)-offset)*sign;
    if(da>=-1e-10)output.push(a);
    if((da>1e-10&&db<-1e-10)||(da<-1e-10&&db>1e-10)){
      const t=da/(da-db);output.push(a.map((v,k)=>v+(b[k]-v)*t));
    }
  }
  return output;
}
export function splitPlane(triangles,n,offset){
  const halves=[[],[]];
  for(const tri of triangles)for(let side=0;side<2;side++){
    const poly=clipPolygon(tri,n,offset,side?1:-1);
    for(let i=1;i<poly.length-1;i++){const t=[poly[0],poly[i],poly[i+1]];if(area([t])>1e-12)halves[side].push(t);}
  }
  return halves;
}
export function fracture(triangles,rng=random(),cuts=2){
  let pieces=[triangles];
  for(let generation=0;generation<cuts;generation++){
    const next=[];
    for(const piece of pieces){
      const c=centroid(piece),n=normal(piece),axis=unit(cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),other=cross(n,axis);
      const angle=rng()*Math.PI,cut=axis.map((v,i)=>v*Math.cos(angle)+other[i]*Math.sin(angle));
      const halves=splitPlane(piece,cut,dot(c,cut));
      if(halves.some(h=>area(h)<1e-6))next.push(piece);else next.push(...halves);
    }
    pieces=next;
  }
  return pieces;
}
const vertexKey=v=>v.slice(0,3).map(n=>Math.round(n*1e5)).join(',');
export function boundaries(triangles){
  const map=new Map();
  for(const t of triangles)for(let i=0;i<3;i++){
    const a=t[i],b=t[(i+1)%3],ka=vertexKey(a),kb=vertexKey(b),key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
    if(map.has(key))map.delete(key);else map.set(key,[a,b]);
  }
  return [...map.values()];
}
export function shellArrays(triangles,thickness=.035){
  const c=centroid(triangles),positions=[],normals=[];
  const push=(v,n,inner=false)=>{for(let k=0;k<3;k++){positions.push(v[k]-c[k]-(inner?v[k+3]*thickness:0));normals.push(n[k]);}};
  for(const t of triangles)for(const v of t)push(v,unit(v.slice(3)));
  const outerCount=positions.length/3;
  for(const t of triangles)for(const v of [t[2],t[1],t[0]])push(v,unit(v.slice(3)).map(v=>-v),true);
  for(const [a,b] of boundaries(triangles)){
    const n=unit(cross(sub(b,a),a.slice(3).map(v=>-v)));
    push(a,n);push(b,n);push(a,n,true);push(b,n);push(b,n,true);push(a,n,true);
  }
  return{positions,normals,centre:c,outerCount};
}
export function unpackSurface(mesh,centre,scale){
  const vertices=[];
  for(let i=0;i<mesh.positions.length;i+=3)vertices.push([
    (mesh.positions[i]-centre[0])*scale,(mesh.positions[i+1]-centre[1])*scale,(mesh.positions[i+2]-centre[2])*scale,
    mesh.normals[i],mesh.normals[i+1],mesh.normals[i+2]]);
  const triangles=[];for(let i=0;i<mesh.indices.length;i+=3)triangles.push([vertices[mesh.indices[i]],vertices[mesh.indices[i+1]],vertices[mesh.indices[i+2]]]);
  return triangles;
}
export function canSplit(piece,count,max=320){return piece.generation<4&&piece.area>.004&&count+3<=max;}
