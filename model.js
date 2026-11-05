export const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function addDays(s,n){let d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return day(d)}
export function week(s){let d=new Date(s+'T12:00:00');return addDays(s,-((d.getDay()+6)%7))}
export function records(t,events){return events.filter(e=>e.taskId===t.id&&!e.deletedAt&&(e.kind!=='step'||e.completesTask===true)).sort((a,b)=>a.date.localeCompare(b.date))}
export function state(t,events,today=day()){
 const r=records(t,events),past=r.filter(e=>e.date<=today),last=past.at(-1),count=past.filter(e=>e.date>=week(today)).length;
 if(t.archivedAt)return {available:false,due:false,count};
 const finished=t.repeat==='once'&&past.length>0;
 const blocked=finished||(t.snoozeUntil&&t.snoozeUntil>today)||(t.due&&t.due>today);
 let done=t.repeat==='weekly'?count>=t.target:past.some(e=>e.date===today);
 let due=false;
 if(t.repeat==='once')due=!!t.due&&t.due<=today;
 if(t.repeat==='daily')due=true;
 if(t.repeat==='days')due=t.days.includes(new Date(today+'T12:00:00').getDay());
 if(t.repeat==='interval')due=last?addDays(last.date,t.interval)<=today:!t.due||t.due<=today;
 return {available:!blocked&&!done&&(t.repeat!=='interval'||due)&&(t.repeat!=='days'||due),due:!blocked&&!done&&due,count,finished};
}
export function validate(data){if(data?.version!==1||!Array.isArray(data.tasks)||!Array.isArray(data.events))throw Error('This is not a Today backup.');const ids=new Set();for(const t of data.tasks){if(typeof t.id!=='string'||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||!['once','daily','days','weekly','interval'].includes(t.repeat)||![5,15,30,60].includes(t.minutes)||!Array.isArray(t.steps)||t.steps.some(s=>typeof s.text!=='string'||typeof s.done!=='boolean')||!Array.isArray(t.days)||t.days.some(n=>!Number.isInteger(n)||n<0||n>6)||!Number.isInteger(t.target)||t.target<1||t.target>7||!Number.isInteger(t.interval)||t.interval<1||t.interval>3650||typeof t.updatedAt!=='string')throw Error('Invalid task in backup.');ids.add(t.id);for(const key of ['due','snoozeUntil'])if(t[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(t[key]))throw Error('Invalid date.')}for(const e of data.events)if(typeof e.id!=='string'||!ids.has(e.taskId)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||typeof e.updatedAt!=='string')throw Error('Invalid history in backup.');return data}

export function recordCompletion(data,id,date,eventId,now){
 const t=data.tasks.find(t=>t.id===id);
 if(records(t,data.events).some(e=>t.repeat==='once'||e.date===date))return false;
 const next=t.steps.find(s=>!s.done),beforeSteps=t.steps.map(s=>({...s}));
 if(next)next.done=true;
 const completesTask=!t.steps.some(s=>!s.done);
 data.events.push({id:eventId,taskId:id,date,updatedAt:now,createdAt:now,...(next?{kind:'step',stepText:next.text,stepId:next.id,completesTask,beforeSteps}:{})});
 if(completesTask&&t.repeat!=='once')t.steps.forEach(s=>s.done=false);
 t.updatedAt=now;return true;
}
export function undoCompletion(data,id,now){
 const e=data.events.find(x=>x.id===id),t=data.tasks.find(t=>t.id===e.taskId);
 if(e.kind==='step'){
  if(data.events.slice(data.events.indexOf(e)+1).some(x=>x.taskId===e.taskId&&!x.deletedAt))return false;
  t.steps.forEach(s=>{const before=e.beforeSteps?.find(b=>s.id?b.id===s.id:b.text===s.text);if(before)s.done=before.done;});
 }else if(t.steps.length)t.steps.forEach(s=>s.done=false);
 e.deletedAt=now;e.updatedAt=now;t.updatedAt=now;return true;
}
