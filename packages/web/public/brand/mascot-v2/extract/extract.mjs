import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'final');
const poses = ['idle', 'working', 'success', 'error', 'sleep'];
const GRID = 4;
const SIZE = 96;
const palette = [[8,18,45],[17,40,77],[29,68,122],[46,119,190],[27,181,224],[75,215,239],[255,255,255],[210,232,244],[255,174,54],[232,124,35],[255,211,105],[126,157,205],[240,137,130],[255,255,255],[5,10,30],[36,91,148],[83,189,226],[188,217,234],[255,193,77],[173,86,32],[255,229,152],[114,131,162],[7,45,82],[0,221,240]];

function decode(file) {
  const b = fs.readFileSync(file);
  if (b.toString('hex',0,8) !== '89504e470d0a1a0a') throw Error(`Not PNG: ${file}`);
  let w, h, depth, type, interlace, data = Buffer.alloc(0), p=8;
  while (p < b.length) { const n=b.readUInt32BE(p), t=b.toString('ascii',p+4,p+8), d=b.subarray(p+8,p+8+n); p+=12+n;
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);depth=d[8];type=d[9];interlace=d[12];}
    if(t==='IDAT') data=Buffer.concat([data,d]); if(t==='IEND') break;
  }
  if(depth!==8 || interlace!==0 || ![2,6].includes(type)) throw Error('PNG must be non-interlaced 8-bit RGB/RGBA');
  const ch=type===6?4:3, raw=zlib.inflateSync(data), stride=w*ch, pixels=Buffer.alloc(h*stride); let q=0;
  for(let y=0;y<h;y++){const f=raw[q++], row=y*stride; for(let x=0;x<stride;x++){const a=x>=ch?pixels[row+x-ch]:0, up=y?pixels[row-stride+x]:0, ul=y&&x>=ch?pixels[row-stride+x-ch]:0, v=raw[q++];
    let z=v; if(f===1)z+=a; else if(f===2)z+=up; else if(f===3)z+=Math.floor((a+up)/2); else if(f===4){const t=a+up-ul, pa=Math.abs(t-a),pb=Math.abs(t-up),pc=Math.abs(t-ul);z+=pa<=pb&&pa<=pc?a:pb<=pc?up:ul;} else if(f!==0) throw Error(`Unknown PNG filter ${f}`); pixels[row+x]=z&255;
  }} return {w,h,ch,pixels};
}
function png(w,h,pix){const rows=Buffer.alloc(h*(1+w*4));for(let y=0;y<h;y++)pix.copy(rows, y*(1+w*4)+1,y*w*4,(y+1)*w*4);const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};const chunk=(t,d)=>{const tb=Buffer.from(t),o=Buffer.alloc(12+d.length);o.writeUInt32BE(d.length);tb.copy(o,4);d.copy(o,8);o.writeUInt32BE(crc(Buffer.concat([tb,d])),8+d.length);return o;};const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
const rgba=(im,x,y)=>{const i=(y*im.w+x)*im.ch;return [im.pixels[i],im.pixels[i+1],im.pixels[i+2],im.ch===4?im.pixels[i+3]:255];};
function keyed(im){const a=new Uint8Array(im.w*im.h);for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++){const [r,g,b]=rgba(im,x,y);const d=Math.max(Math.abs(r-255),g,Math.abs(b-255));a[y*im.w+x]=d<45?0:255;}return a;}
function components(im,mask){const seen=new Uint8Array(mask.length), cs=[];for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++){let id=y*im.w+x;if(!mask[id]||seen[id])continue;let st=[id],c=[];seen[id]=1;while(st.length){const z=st.pop(),xx=z%im.w,yy=(z/im.w)|0;c.push(z);for(const [nx,ny] of [[xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]])if(nx>=0&&ny>=0&&nx<im.w&&ny<im.h){const ni=ny*im.w+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;st.push(ni);}}}if(c.length>25)cs.push(c);}return cs;}
function nearest(c){let best=palette[0],bd=Infinity;for(const p of palette){const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;best=p;}}return best;}
function extract(im, bounds){const [x0,y0,x1,y1]=bounds, w=x1-x0+1,h=y1-y0+1, mask=keyed(im), gx=Math.max(1,Math.round(w/GRID)),gy=Math.max(1,Math.round(h/GRID));let cells=[];
 for(let cy=0;cy<gy;cy++)for(let cx=0;cx<gx;cx++){const tally=new Map();for(let y=y0+cy*GRID;y<Math.min(y1+1,y0+(cy+1)*GRID);y++)for(let x=x0+cx*GRID;x<Math.min(x1+1,x0+(cx+1)*GRID);x++){const i=y*im.w+x;if(!mask[i])continue;const col=rgba(im,x,y),key=nearest(col).join(',');tally.set(key,(tally.get(key)||0)+1);}const v=[...tally].sort((a,b)=>b[1]-a[1])[0];cells.push(v?v[0].split(',').map(Number):null);}
 const scale=Math.min(1,(SIZE-8)/Math.max(gx,gy)), dw=Math.max(1,Math.round(gx*scale)),dh=Math.max(1,Math.round(gy*scale)),canvas=Buffer.alloc(SIZE*SIZE*4), ox=((SIZE-dw)/2)|0,oy=SIZE-dh-4;
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const col=cells[Math.min(gy-1,Math.floor(y*gy/dh))*gx+Math.min(gx-1,Math.floor(x*gx/dw))];if(col){const i=((oy+y)*SIZE+ox+x)*4;canvas.set([...col,255],i);}}
 // Remove isolated single-cell noise while preserving intentional detached effects.
 const copy=Buffer.from(canvas);for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){const i=(y*SIZE+x)*4;if(!canvas[i+3])continue;let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)n+=canvas[((y+dy)*SIZE+x+dx)*4+3]>0;if(n===0)copy[i+3]=0;}return copy;}
function svg(pix){let s=`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" shape-rendering="crispEdges">`;for(let y=0;y<96;y++){let x=0;while(x<96){const i=(y*96+x)*4;if(!pix[i+3]){x++;continue;}let end=x+1;while(end<96){const j=(y*96+end)*4;if(!pix[j+3]||pix[j]!==pix[i]||pix[j+1]!==pix[i+1]||pix[j+2]!==pix[i+2])break;end++;}s+=`<rect x="${x}" y="${y}" width="${end-x}" height="1" fill="rgb(${pix[i]},${pix[i+1]},${pix[i+2]})"/>`;x=end;}}return s+'</svg>';}
fs.mkdirSync(out,{recursive:true});
const sheet=decode(path.join(root,'concepts-b','sheet.png'));
const boundsList=[[62,150,293,590],[315,200,600,590],[550,135,830,555],[845,200,1075,590],[1060,315,1347,600]];
const all=[];for(let i=0;i<5;i++){const bounds=boundsList[i],pix=extract(sheet,bounds);all.push(pix);fs.writeFileSync(path.join(out,`onni-${poses[i]}.png`),png(96,96,pix));fs.writeFileSync(path.join(out,`onni-${poses[i]}.svg`),svg(pix));console.log(`${poses[i]} bbox=${bounds.join(',')} canvas=96x96`);}
const hero=decode(path.join(root,'concepts-b','concept-1.png'));const hm=keyed(hero), comps=components(hero,hm);let hb=[hero.w,hero.h,0,0];for(const c of comps)for(const v of c){const x=v%hero.w,y=(v/hero.w)|0;hb[0]=Math.min(hb[0],x);hb[1]=Math.min(hb[1],y);hb[2]=Math.max(hb[2],x);hb[3]=Math.max(hb[3],y);}const hp=extract(hero,hb);fs.writeFileSync(path.join(out,'onni-hero.png'),png(96,96,hp));fs.writeFileSync(path.join(out,'onni-hero.svg'),svg(hp));
for(const size of [32,16]){const p=Buffer.alloc(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const sx=16+Math.floor(x*64/size),sy=9+Math.floor(y*52/size),i=(sy*96+sx)*4,j=(y*size+x)*4;p.set(hp.subarray(i,i+4),j);}fs.writeFileSync(path.join(out,`onni-head-${size}.png`),png(size,size,p));}
const strip=Buffer.alloc(96*5*96*4);all.forEach((p,n)=>{for(let y=0;y<96;y++)p.copy(strip,(y*480+n*96)*4,y*384,(y+1)*384);});fs.writeFileSync(path.join(out,'sprite-sheet.png'),png(480,96,strip));fs.writeFileSync(path.join(out,'sprite-frames.json'),JSON.stringify(Object.fromEntries(poses.map((p,i)=>[p,{x:i*96,y:0,width:96,height:96}])),null,2)+'\n');
// Preview: three background checks at 1x and 4x, plus both face crops.
const pw=1340,ph=1020,prev=Buffer.alloc(pw*ph*4);const rect=(x,y,w,h,c)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)prev.set([...c,255],(yy*pw+xx)*4);};const blit=(p,x,y,scale)=>{for(let yy=0;yy<96;yy++)for(let xx=0;xx<96;xx++){const i=(yy*96+xx)*4;if(p[i+3])rect(x+xx*scale,y+yy*scale,scale,scale,[p[i],p[i+1],p[i+2]]);}};
all.forEach((p,i)=>{const x=10+i*205;[[255,255,255],[35,39,51],[8,18,45]].forEach((bg,j)=>{rect(x,10+j*160,195,150,bg);blit(p,x+49,35+j*160,1);});blit(p,x,520,1);blit(p,x+100,520,4);});
const loadPng=decode(path.join(out,'onni-head-32.png'));const head32=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++)head32.set(rgba(loadPng,x,y),(y*32+x)*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const c=rgba(loadPng,x,y);if(c[3])rect(30+x*2,705+y*2,2,2,c.slice(0,3));}const load16=decode(path.join(out,'onni-head-16.png'));for(let y=0;y<16;y++)for(let x=0;x<16;x++){const c=rgba(load16,x,y);if(c[3])rect(120+x*2,705+y*2,2,2,c.slice(0,3));}
const packed=Buffer.from(prev);fs.writeFileSync(path.join(out,'preview.png'),png(pw,ph,packed));
console.log(`Wrote ${poses.length*2+8} assets; grid=${GRID}px, shared palette=${palette.length}, preview=${pw}x${ph}`);
