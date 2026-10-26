"use client";
import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Check, Clock3, Copy, LoaderCircle, Plus, Users, X } from "lucide-react";

const PRIMARY_API = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://wardrowbe-api-chi.vercel.app/api/v1").replace(/\/$/, "");
const FALLBACK_API = "https://wardrowbe-api-chi.vercel.app/api/v1";
type Schedule={id:string;day_of_week:number;notification_time:string;occasion:string;enabled:boolean;notify_day_before:boolean};
type Family={id:string;name:string;invite_code:string;members:{id:string;display_name:string;email:string;role:string}[];pending_invites:{id:string;email:string;expires_at:string}[]};
type StylePrefs={color_favorites:string[];color_avoid:string[];style_profile:Record<string,number>};
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export function SettingsExtras(){
  const {data:session}=useSession();
  const token=(session as any)?.accessToken as string|undefined;
  const [schedules,setSchedules]=useState<Schedule[]>([]);
  const [stylePrefs,setStylePrefs]=useState<StylePrefs|null>(null);
  const [favoriteColors,setFavoriteColors]=useState("");
  const [avoidColors,setAvoidColors]=useState("");
  const [family,setFamily]=useState<Family|null>(null);
  const [familyChecked,setFamilyChecked]=useState(false);
  const [familyName,setFamilyName]=useState("");
  const [inviteCode,setInviteCode]=useState("");
  const [day,setDay]=useState(0);
  const [time,setTime]=useState("08:00");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const request=useCallback(async<T,>(path:string,init:RequestInit={}):Promise<T>=>{
    const headers=new Headers(init.headers);headers.set("Authorization",`Bearer ${token}`);
    if(init.body)headers.set("Content-Type","application/json");
    const endpoints = [PRIMARY_API];
    if (PRIMARY_API !== FALLBACK_API) endpoints.push(FALLBACK_API);
    let response: Response | undefined;
    for (const endpoint of endpoints) {
      try {
        response = await fetch(`${endpoint}${path}`, { ...init, headers });
        if (response.status < 500) break;
      } catch {}
    }
    if (!response) throw new Error("Could not reach the wardrobe service.");
    if(!response.ok){const body=await response.json().catch(()=>({}));if(response.status===401)void signOut({callbackUrl:"/login"});throw new Error(typeof body.detail==="string"?body.detail:body.detail?.message||`Request failed (${response.status})`)}
    if(response.status===204)return undefined as T;
    return response.json();
  },[token]);
  const load=useCallback(async()=>{
    if(!token)return;setLoading(true);setError("");
    try{const values=await Promise.all([request<Schedule[]>("/notifications/schedules"),request<Family>("/families/me").catch(()=>null),request<StylePrefs>("/users/me/preferences")]);setSchedules(values[0]);setFamily(values[1]);setStylePrefs(values[2]);setFavoriteColors(values[2].color_favorites.join(", "));setAvoidColors(values[2].color_avoid.join(", "));}
    catch(e){setError(e instanceof Error?e.message:"Unable to load these settings.")}
    finally{setFamilyChecked(true);setLoading(false)}
  },[token,request]);
  useEffect(()=>{void load()},[load]);
  const action=async(work:()=>Promise<any>,done:string)=>{setError("");setMessage("");try{const result=await work();setMessage(done);return result}catch(e){setError(e instanceof Error?e.message:"The change could not be saved.")}};
  const addSchedule=async()=>{const value=await action(()=>request<Schedule>("/notifications/schedules",{method:"POST",body:JSON.stringify({day_of_week:day,notification_time:time,occasion:"casual",enabled:true,notify_day_before:false})}),"Reminder added.");if(value)setSchedules(v=>[...v,value].sort((a,b)=>a.day_of_week-b.day_of_week))};
  const toggleSchedule=async(row:Schedule)=>{const value=await action(()=>request<Schedule>(`/notifications/schedules/${row.id}`,{method:"PATCH",body:JSON.stringify({enabled:!row.enabled})}),"Reminder updated.");if(value)setSchedules(v=>v.map(s=>s.id===row.id?value:s))};
  const deleteSchedule=async(row:Schedule)=>{const done=await action(()=>request<void>(`/notifications/schedules/${row.id}`,{method:"DELETE"}),"Reminder removed.");if(done!==undefined)setSchedules(v=>v.filter(s=>s.id!==row.id))};
  const saveStylePrefs=async()=>{if(!stylePrefs)return;const next={...stylePrefs,color_favorites:favoriteColors.split(",").map(x=>x.trim()).filter(Boolean),color_avoid:avoidColors.split(",").map(x=>x.trim()).filter(Boolean)};const value=await action(()=>request<StylePrefs>("/users/me/preferences",{method:"PATCH",body:JSON.stringify(next)}),"Style preferences saved.");if(value)setStylePrefs(value)};
  const createFamily=async()=>{const value=await action(()=>request<Family>("/families",{method:"POST",body:JSON.stringify({name:familyName})}),"Household created.");if(value){setFamilyName("");await load()}};
  const joinFamily=async()=>{const value=await action(()=>request<any>("/families/join",{method:"POST",body:JSON.stringify({invite_code:inviteCode})}),"Joined household.");if(value){setInviteCode("");await load()}};
  const leaveFamily=async()=>{if(!window.confirm("Leave this household? You will lose access to its shared wardrobe and outfits."))return;const value=await action(()=>request<any>("/families/me/leave",{method:"POST",body:"{}"}),"Left household.");if(value)setFamily(null)};
  if(!token)return null;
  return <div className="settings-extras">
    <section className="settings-section"><div className="settings-title"><div className="setting-icon"><Check size={17}/></div><div><h2>Color and style notes</h2><p className="muted">Help your stylist learn what feels like you.</p></div></div>{stylePrefs&&<><div className="form-grid"><label>Colors you enjoy<input value={favoriteColors} onChange={e=>setFavoriteColors(e.target.value)} placeholder="Olive, cream, navy"/><small>Separate colors with commas.</small></label><label>Colors to skip<input value={avoidColors} onChange={e=>setAvoidColors(e.target.value)} placeholder="Colors you rarely wear"/><small>Leave blank if you’re open to anything.</small></label></div><div className="style-ranges">{Object.entries(stylePrefs.style_profile||{}).map(([key,value])=><label key={key}>{key}<input aria-label={`${key} style preference`} type="range" min="0" max="100" value={value} onChange={e=>setStylePrefs({...stylePrefs,style_profile:{...stylePrefs.style_profile,[key]:Number(e.target.value)}})}/></label>)}</div><button className="button secondary" onClick={saveStylePrefs}>Save style notes</button></>}</section>
    <section className="settings-section"><div className="settings-title"><div className="setting-icon"><Clock3 size={17}/></div><div><h2>Outfit reminders</h2><p className="muted">Choose when FORME should remind you about a look.</p></div></div>
      {loading?<div className="extra-loading"><LoaderCircle className="spin" size={15}/> Loading reminders</div>:<>{schedules.length>0&&<div className="schedule-list">{schedules.map(row=><div className="schedule-row" key={row.id}><span className="schedule-day">{DAYS[row.day_of_week]}</span><span className="schedule-time">{row.notification_time}</span><button className={`schedule-toggle ${row.enabled?"on":""}`} aria-label={`${row.enabled?"Disable":"Enable"} ${DAYS[row.day_of_week]} reminder`} onClick={()=>toggleSchedule(row)}>{row.enabled?"On":"Off"}</button><button className="icon-button" aria-label="Remove reminder" onClick={()=>deleteSchedule(row)}><X size={14}/></button></div>)}</div>}<div className="schedule-create"><select aria-label="Day of week" value={day} onChange={e=>setDay(Number(e.target.value))}>{DAYS.map((label,index)=><option value={index} key={label}>{label}</option>)}</select><input aria-label="Reminder time" type="time" value={time} onChange={e=>setTime(e.target.value)}/><button className="button secondary" onClick={addSchedule}><Plus size={14}/> Add reminder</button></div>{schedules.length===0&&<p className="extra-empty">No reminders yet. Add a day and time to create one.</p>}</>}
    </section>
    <section className="settings-section"><div className="settings-title"><div className="setting-icon"><Users size={17}/></div><div><h2>Household wardrobe</h2><p className="muted">Share wardrobe planning with the people you dress alongside.</p></div></div>
      {family?<><div className="family-heading"><strong>{family.name}</strong><span>{family.members.length} {family.members.length===1?"member":"members"}</span></div><div className="family-members">{family.members.map(member=><div key={member.id}><span className="avatar">{member.display_name.slice(0,1)}</span><span><strong>{member.display_name}</strong><small>{member.email}</small></span><small className="member-role">{member.role}</small></div>)}</div><div className="invite-code"><span><small>Share this invite code</small><strong>{family.invite_code}</strong></span><button className="button secondary" onClick={()=>navigator.clipboard?.writeText(family.invite_code).then(()=>setMessage("Invite code copied."))}><Copy size={14}/> Copy code</button></div><button className="text-button danger-text" onClick={leaveFamily}>Leave household</button></>:familyChecked?<div className="family-actions"><form onSubmit={e=>{e.preventDefault();void createFamily()}}><label>Create a household<input value={familyName} onChange={e=>setFamilyName(e.target.value)} placeholder="Household name" maxLength={100}/></label><button className="button secondary" disabled={!familyName.trim()}><Plus size={14}/> Create household</button></form><form onSubmit={e=>{e.preventDefault();void joinFamily()}}><label>Join with an invite code<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="Enter code" maxLength={20}/></label><button className="button secondary" disabled={!inviteCode.trim()}>Join household <Check size={14}/></button></form></div>:null}
    </section>
    {(error||message)&&<div className={`alert ${error?"error":"success"}`}><span>{error||message}</span><button className="icon-button" onClick={()=>{setError("");setMessage("")}} aria-label="Dismiss"><X size={14}/></button></div>}
  </div>;
}
