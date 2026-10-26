"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { SettingsExtras } from "./settings/extras";
import { FormeBrand, FormeMark } from "./components/brand";
import {
  Activity, Archive, ArrowRight, Camera, Check, CheckCircle2, ChevronDown,
  CircleHelp, Cloud, CloudSun, Heart, Home, Image as ImageIcon, Layers3,
  LoaderCircle, LogOut, Menu, Plus, Search, Settings2, Shirt,
  SlidersHorizontal, Sparkles, Sun, Trash2, Upload, X,
} from "lucide-react";

async function prepareImageForUpload(file: File, maxDim = 2048, quality = 0.90): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  return new Promise<File>((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const optimized = new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(optimized.size < file.size ? optimized : file);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://forme-api.hassankarasu.dev/api/v1").replace(/\/$/, "");
const OCCASIONS = ["casual","office","work","formal","smart-casual","business-casual","date","party","sporty","sport","outdoor","travel","lounge","beach","interview","wedding","dinner","brunch","gym","running","hiking","weekend"];
const CATEGORIES: Record<string, string[]> = {
  tops: ["shirt","t-shirt","top","sweater","hoodie","polo","blouse","tank-top"],
  bottoms: ["pants","jeans","shorts","skirt","tights"],
  outerwear: ["jacket","coat","blazer","suit","vest","cardigan"],
  "one piece": ["dress","jumpsuit"],
  shoes: ["shoes","sneakers","boots","sandals","socks"],
  accessories: ["tie","hat","scarf","belt","bag","accessories"],
};

const COLOR_MAP: Record<string, string> = {
  black: "#18181b",
  white: "#f5f5f4",
  ivory: "#fffff0",
  cream: "#f3efe0",
  offwhite: "#f0ece1",
  "off-white": "#f0ece1",
  navy: "#1e293b",
  blue: "#3b82f6",
  "light-blue": "#93c5fd",
  denim: "#476b8f",
  olive: "#6b7856",
  sage: "#a8b99a",
  green: "#4d7c5d",
  charcoal: "#3f3f46",
  grey: "#71717a",
  gray: "#71717a",
  silver: "#cbd5e1",
  beige: "#d9ccb4",
  tan: "#c8ad88",
  camel: "#b99364",
  khaki: "#b5ab88",
  taupe: "#8b7d70",
  brown: "#6b4c3b",
  burgundy: "#6b2130",
  maroon: "#6b2130",
  red: "#b93838",
  pink: "#d896a7",
  blush: "#e4b7be",
  coral: "#d97762",
  orange: "#d07642",
  yellow: "#d9b44a",
  gold: "#c7a354",
  mustard: "#c49a38",
  purple: "#7c5285",
  lavender: "#b49fcc",
};

function colorSwatch(name?: string | null): string {
  if (!name) return "#8a9481";
  const key = name.toLowerCase().trim().replace(/\s+/g, "-");
  return COLOR_MAP[key] || COLOR_MAP[key.split("-").pop() || ""] || "#8a9481";
}

type Item = { id:string; name?:string|null; type:string; subtype?:string|null; image_url?:string; thumbnail_url?:string|null; medium_url?:string|null; favorite?:boolean; colors?:string[]; primary_color?:string|null; tags?:Record<string,any>; style?:string[]; season?:string[]; status?:string; tagging_status?:string; ai_processed?:boolean; created_at?:string; wear_count?:number; notes?:string|null; brand?:string|null };
type OutfitItem = { id:string; name?:string|null; type:string; image_url?:string|null; thumbnail_url?:string|null; primary_color?:string|null };
type Outfit = { id:string; name?:string|null; occasion:string; status:string; reasoning?:string|null; style_notes?:string|null; items:OutfitItem[]; created_at?:string; weather?:any; source?:string; feedback?:any };
type Profile = { id:string; email:string; display_name:string; avatar_url?:string|null; location_name?:string|null; location_lat?:number|null; location_lon?:number|null; timezone:string; locale:string };
type Preferences = { default_occasion:string; color_favorites:string[]; color_avoid:string[]; temperature_unit:string; temperature_sensitivity:string; layering_preference:string; avoid_repeat_days:number; prefer_underused_items:boolean; variety_level:string; style_profile:Record<string,number> };
type Weather = { temperature:number; condition:string; feels_like:number; precipitation_chance:number };
type PageData = { items?:Item[]; total?:number; outfits?:Outfit[]; wardrobe?:any; color_distribution?:any[] };

async function api<T>(path:string, token:string, init:RequestInit={}) : Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && init.body != null) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new Error("Could not reach the wardrobe service. Check the backend URL and try again.");
  }

  if (!response.ok) {
    const body = await response.json().catch(()=>({}));
    if(response.status===401)void signOut({callbackUrl:"/login"});
    throw new Error(typeof body.detail === "string" ? body.detail : body.detail?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
const json = (method:string, body?:unknown):RequestInit => ({ method, body:body===undefined?undefined:JSON.stringify(body) });
const title = (name?:string|null) => name || "Untitled piece";
const photo = (item:Item|OutfitItem, large=false) => (large ? (item.image_url || item.thumbnail_url) : (item.thumbnail_url || item.image_url)) || "";
const displayDate = new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(new Date());
const navigation = [
  { href:"/dashboard", label:"Dashboard", icon:Home },
  { href:"/wardrobe/add", label:"Add clothing", icon:Plus },
  { href:"/wardrobe", label:"My wardrobe", icon:Shirt },
  { href:"/stylist", label:"AI stylist", icon:Sparkles },
  { href:"/outfits", label:"Outfits", icon:Layers3 },
  { href:"/settings", label:"Preferences", icon:Settings2 },
];

function Image({src,alt="",className=""}:{src?:string;alt?:string;className?:string}) {
  const [broken,setBroken]=useState(false);
  if(!src||broken) return <div className={`image-fallback ${className}`} aria-label={alt}><Shirt size={26} strokeWidth={1.25}/></div>;
  return <img src={src} alt={alt} className={className} onError={()=>setBroken(true)}/>;
}

function ItemTile({item,onOpen,onFavorite}:{item:Item;onOpen?:()=>void;onFavorite?:(item:Item)=>void}) {
  const itemColors = (item.colors && item.colors.length > 0)
    ? item.colors.slice(0, 3)
    : item.primary_color ? [item.primary_color] : [];

  return (
    <article
      className="item-card"
      onClick={onOpen}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={e => { if (onOpen && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}
    >
      <div className="item-photo">
        <Image src={photo(item)} alt={title(item.name)} />
        {item.brand && <span className="item-brand-pill">{item.brand}</span>}
        {onFavorite && (
          <button
            className={`icon-button favorite ${item.favorite ? "selected" : ""}`}
            aria-label={item.favorite ? "Remove favorite" : "Add to favorites"}
            onClick={e => { e.stopPropagation(); onFavorite(item); }}
          >
            <Heart size={15} fill={item.favorite ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      <div className="item-meta">
        <div className="item-meta-top">
          <span className="item-name">{title(item.name)}</span>
          {itemColors.length > 0 && (
            <span className="item-swatches" aria-label={`Colors: ${itemColors.join(", ")}`}>
              {itemColors.map((c, idx) => (
                <i key={idx} className="color-dot" style={{ backgroundColor: colorSwatch(c) }} title={c} />
              ))}
            </span>
          )}
        </div>
        <div className="item-meta-sub">
          <span className="item-type">{item.subtype || item.type}</span>
          {typeof item.wear_count === "number" && item.wear_count > 0 && (
            <span className="item-wears">{item.wear_count}× worn</span>
          )}
        </div>
      </div>
    </article>
  );
}

function OutfitCard({outfit,onOpen}:{outfit:Outfit;onOpen:()=>void}) {
  return (
    <button className="outfit-card" onClick={onOpen}>
      <div className="outfit-images">
        {(outfit.items || []).slice(0, 4).map((item, i) => (
          <Image key={item.id || i} src={photo(item)} alt={title(item.name)} />
        ))}
      </div>
      <div className="outfit-card-footer">
        <div className="outfit-card-copy">
          <span className="outfit-card-title">{outfit.name || `${outfit.occasion} look`}</span>
          <span className="outfit-card-meta">
            {outfit.occasion.replace(/-/g, " ")} · {(outfit.items || []).length} pieces
          </span>
        </div>
        <span className="outfit-card-arrow">
          <ArrowRight size={15} />
        </span>
      </div>
    </button>
  );
}

function Busy({label="Loading your wardrobe"}:{label?:string}) {
  return <div className="busy"><LoaderCircle className="spin" size={18}/><span>{label}</span></div>;
}

function AnalyticsSummary({colors}:{colors?:{color:string;count:number;percentage:number}[]}) {
  if(!colors?.length)return null;
  return (
    <section className="color-summary">
      <div>
        <p className="eyebrow">WARDROBE PALETTE</p>
        <h2>The colors you reach for</h2>
        <p className="muted color-summary-sub">Your dominant tones across cataloged garments.</p>
      </div>
      <div className="color-bars">
        {colors.slice(0, 6).map(row => (
          <div key={row.color}>
            <span className="color-bar-label">
              <em className="color-dot" style={{ backgroundColor: colorSwatch(row.color) }} />
              {row.color.replace(/-/g, " ")}
            </span>
            <div className="color-bar-track">
              <i style={{ width: `${Math.max(4, Math.min(100, row.percentage))}%`, backgroundColor: colorSwatch(row.color) }} />
            </div>
            <small>{row.count}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const {data:session,status}=useSession();
  const token=(session as any)?.accessToken as string|undefined;
  const syncError=(session as any)?.syncError as string|undefined;
  const pathname=usePathname()||"/dashboard";
  const router=useRouter();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [pageData,setPageData]=useState<PageData>({});
  const [weather,setWeather]=useState<Weather|null>(null);
  const [recommendation,setRecommendation]=useState<Outfit|null>(null);
  const [preferences,setPreferences]=useState<Preferences|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("all");
  const [favoriteOnly,setFavoriteOnly]=useState(false);
  const [colorFilter,setColorFilter]=useState("");
  const [seasonFilter,setSeasonFilter]=useState("");
  const [selectedItem,setSelectedItem]=useState<Item|null>(null);
  const [selectedOutfit,setSelectedOutfit]=useState<Outfit|null>(null);
  const [pairings,setPairings]=useState<Outfit[]>([]);
  const [pairingsLoading,setPairingsLoading]=useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [occasion,setOccasion]=useState("casual");
  const [uploadFiles,setUploadFiles]=useState<File[]>([]);
  const [uploadProgress,setUploadProgress]=useState<{current:number;total:number;stage:string}|null>(null);
  const [dragging,setDragging]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [maxUpload,setMaxUpload]=useState(50);
  const [editForm,setEditForm]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const galleryRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);

  const request=useCallback(<T,>(path:string,init:RequestInit={})=>api<T>(path,token!,init),[token]);
  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);setError("");
    try {
      const [me,itemsResult,outfitResult]=await Promise.all([
        request<Profile>("/users/me"),
        request<any>("/items?page=1&page_size=60&sort_by=created_at&sort_order=desc"),
        request<any>("/outfits?page=1&page_size=24"),
      ]);
      setProfile(me);setPageData({items:itemsResult.items||[],total:itemsResult.total||0,outfits:outfitResult.outfits||[]});
      if(pathname==="/dashboard"||pathname==="/")setRecommendation((outfitResult.outfits||[]).find((o:Outfit)=>o.status==="pending")||(outfitResult.outfits||[])[0]||null);
      if(pathname==="/dashboard"||pathname==="/"||pathname==="/stylist"){
        try{const savedPreferences=await request<Preferences>("/users/me/preferences");setPreferences(savedPreferences);setOccasion(savedPreferences.default_occasion)}catch{}
        try{setWeather(await request<Weather>("/weather/current"))}catch{setWeather(null)}
      }
      if(pathname==="/settings"){
        try{const [p]=await Promise.all([request<Preferences>("/users/me/preferences")]);setPreferences(p);setOccasion(p.default_occasion)}catch{}
      }
      if(pathname==="/dashboard"||pathname==="/"){
        try{const analytics=await request<any>("/analytics");setPageData(v=>({...v,wardrobe:analytics.wardrobe,color_distribution:analytics.color_distribution}))}catch{}
      }
    } catch(e){setError(e instanceof Error?e.message:"Unable to load this page.")} finally{setLoading(false)}
  },[token,pathname,request]);

  useEffect(()=>{if(status==="authenticated"&&token)void load()},[status,token,load]);
  useEffect(() => {
    fetch(`${API}/health/features`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.max_upload_size_mb === "number") setMaxUpload(d.max_upload_size_mb);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "SELECT") {
        if (searchRef.current) {
          e.preventDefault();
          searchRef.current.focus();
        }
      }
      if (e.key === "Escape") {
        setSelectedItem(null);
        setSelectedOutfit(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleFiles = (fileList: FileList | null | File[]) => {
    if (!fileList || fileList.length === 0) return;
    const supported = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const incoming = Array.from(fileList);
    const validFiles: File[] = [];

    for (const f of incoming) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const isSupported = supported.includes(f.type) || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext || "");
      if (!isSupported) continue;
      if (f.size > maxUpload * 1024 * 1024) continue;
      validFiles.push(f);
    }

    if (validFiles.length === 0) {
      setError("Please choose JPEG, PNG, WebP, or HEIC images.");
      return;
    }

    setError("");
    setUploadFiles(prev => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 50) {
        setError("Maximum 50 photos can be cataloged at once. Added up to 50.");
        return combined.slice(0, 50);
      }
      return combined;
    });
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const run=async <T,>(work:()=>Promise<T>,success?:string)=>{
    setError("");setNotice("");
    try{const result=await work();if(success)setNotice(success);return result}
    catch(e){setError(e instanceof Error?e.message:"Something went wrong.");return undefined}
  };
  const filteredItems=useMemo(()=>{
    let rows=pageData.items||[];
    if(category!=="all")rows=rows.filter(i=>(CATEGORIES[category]||[]).includes(i.type.toLowerCase()));
    if(favoriteOnly)rows=rows.filter(i=>i.favorite);
    if(colorFilter)rows=rows.filter(i=>(i.colors||i.tags?.colors||[]).some((v:string)=>v.toLowerCase()===colorFilter));
    if(seasonFilter)rows=rows.filter(i=>(i.season||i.tags?.season||[]).some((v:string)=>v.toLowerCase()===seasonFilter));
    if(search.trim())rows=rows.filter(i=>`${i.name||""} ${i.type} ${i.subtype||""} ${i.brand||""} ${(i.colors||[]).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
    return rows;
  },[pageData.items,category,favoriteOnly,colorFilter,seasonFilter,search]);

  const categoryCounts = useMemo(() => {
    const items = pageData.items || [];
    const counts: Record<string, number> = { all: items.length };
    for (const [cat, types] of Object.entries(CATEGORIES)) {
      counts[cat] = items.filter(i => types.includes(i.type.toLowerCase())).length;
    }
    return counts;
  }, [pageData.items]);

  const favoritesCount = useMemo(() => (pageData.items || []).filter(i => i.favorite).length, [pageData.items]);

  const pageName=pathname.startsWith("/wardrobe/add")?"Add clothing":pathname==="/wardrobe"?"My wardrobe":pathname==="/stylist"?"Your personal stylist":pathname==="/outfits"?"Outfits":pathname==="/settings"?"Preferences":"Dashboard";
  const weatherTemp=weather?Math.round(preferences?.temperature_unit==="fahrenheit"?weather.temperature*9/5+32:weather.temperature):null;
  const weatherUnit=preferences?.temperature_unit==="fahrenheit"?"°F":"°C";
  const isAdd=pathname.startsWith("/wardrobe/add"), isWardrobe=pathname==="/wardrobe", isStylist=pathname==="/stylist", isOutfits=pathname==="/outfits", isSettings=pathname==="/settings", isDashboard=pathname==="/"||pathname==="/dashboard";

  useEffect(()=>{if(selectedItem){const tags=selectedItem.tags||{};setPairings([]);setEditForm({name:selectedItem.name||"",type:selectedItem.type||"unknown",subtype:selectedItem.subtype||"",brand:selectedItem.brand||"",notes:selectedItem.notes||"",tags:{...tags,styleText:(selectedItem.style||tags.style||[]).join(", "),seasonText:(selectedItem.season||tags.season||[]).join(", ")},colors:(selectedItem.colors||[]).join(", "),favorite:!!selectedItem.favorite})}},[selectedItem]);
  const refresh=()=>void load();
  const toggleFavorite=async(item:Item)=>{const updated=await run(()=>request<Item>(`/items/${item.id}`,json("PATCH",{favorite:!item.favorite})));if(updated)setPageData(d=>({...d,items:d.items?.map(i=>i.id===item.id?updated:i)}))};
  const generate=async()=>{setLoading(true);const result=await run(()=>request<Outfit>("/outfits/suggest",json("POST",{occasion})));if(result)setRecommendation(result);setLoading(false)};
  const saveOutfit=async(outfit:Outfit)=>{const result=await run(()=>request<Outfit>(`/outfits/${outfit.id}/accept`,json("POST")),"Look saved to your outfits.");if(result){setSelectedOutfit(result);refresh()}};
  const outfitFeedback=async(outfit:Outfit,data:Record<string,unknown>,message:string)=>{const result=await run<any>(()=>request<any>(`/outfits/${outfit.id}/feedback`,json("POST",data)),message);if(result){const updated={...outfit,feedback:{...outfit.feedback,...result}};setSelectedOutfit(updated);setPageData(d=>({...d,outfits:d.outfits?.map(o=>o.id===outfit.id?updated:o)}))}};
  const saveItem=async()=>{if(!selectedItem)return;setSaving(true);const payload={name:editForm.name||null,type:editForm.type,subtype:editForm.subtype||null,brand:editForm.brand||null,notes:editForm.notes||null,favorite:!!editForm.favorite,colors:editForm.colors.split(",").map((s:string)=>s.trim()).filter(Boolean),tags:{...editForm.tags,style:(editForm.tags?.styleText||"").split(",").map((s:string)=>s.trim()).filter(Boolean),season:(editForm.tags?.seasonText||"").split(",").map((s:string)=>s.trim()).filter(Boolean)}};const item=await run(()=>request<Item>(`/items/${selectedItem.id}`,json("PATCH",payload)),"Clothing details saved.");if(item){setSelectedItem(item);setPageData(d=>({...d,items:d.items?.map(i=>i.id===item.id?item:i)}))}setSaving(false)};
  const logItemActivity=async(kind:"wear"|"wash")=>{if(!selectedItem)return;const result=await run(()=>request<Item>(`/items/${selectedItem.id}/${kind}`,json("POST",{})),kind==="wear"?"Wear logged.":"Wash logged.");if(result){setSelectedItem(result);setPageData(d=>({...d,items:d.items?.map(i=>i.id===result.id?result:i)}))}};
  const findPairings=async()=>{if(!selectedItem)return;setPairingsLoading(true);const result=await run<any>(()=>request<any>(`/pairings/generate/${selectedItem.id}`,json("POST",{num_pairings:3})));if(result)setPairings(result.pairings||[]);setPairingsLoading(false)};
  const deleteItem=async()=>{if(!selectedItem||!window.confirm(`Remove ${title(selectedItem.name)} from your wardrobe? This cannot be undone.`))return;setError("");try{await request<void>(`/items/${selectedItem.id}`,{method:"DELETE"});setNotice("Clothing removed.");setSelectedItem(null);setPageData(d=>({...d,items:d.items?.filter(i=>i.id!==selectedItem.id),total:Math.max(0,(d.total||1)-1)}))}catch(e){setError(e instanceof Error?e.message:"Unable to remove this piece.")}};
  const upload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setError("");
    setNotice("");

    let successCount = 0;
    const total = uploadFiles.length;

    for (let i = 0; i < total; i++) {
      const file = uploadFiles[i];
      setUploadProgress({
        current: i + 1,
        total,
        stage: `Cleaning background & AI tagging (${file.name})...`,
      });

      try {
        const optimized = await prepareImageForUpload(file);
        const form = new FormData();
        form.append("image", optimized);
        form.append("skip_ai", "false");
        form.append("auto_remove_bg", "true");

        await request<Item>("/items", { method: "POST", body: form });
        successCount++;
      } catch (err: any) {
        console.error(`Failed to catalog ${file.name}:`, err);
      }
    }

    setUploading(false);
    setUploadProgress(null);

    if (successCount > 0) {
      setUploadFiles([]);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      setNotice(
        successCount === total
          ? `Successfully added ${successCount} piece${successCount > 1 ? "s" : ""} to your wardrobe. Backgrounds removed & AI vision tagging in progress.`
          : `Added ${successCount} of ${total} piece(s). Some items encountered issues.`
      );
      router.push("/wardrobe");
      refresh();
    } else {
      setError("Failed to upload the selected photos. Please check your network and try again.");
    }
  };
  const saveSettings=async()=>{if(!profile||!preferences)return;setSaving(true);setError("");setNotice("");try{const [me,prefs]=await Promise.all([request<Profile>("/users/me",json("PATCH",{display_name:profile.display_name,location_name:profile.location_name||null,timezone:profile.timezone,locale:profile.locale}),),request<Preferences>("/users/me/preferences",json("PATCH",preferences))]);setProfile(me);setPreferences(prefs);setNotice("Preferences saved.")}catch(e){setError(e instanceof Error?e.message:"Unable to save preferences.")}finally{setSaving(false)}};

  if(status==="loading")return <div className="auth-loading"><FormeMark size={46}/><Busy label="Opening your atelier"/></div>;
  if(status!=="authenticated")return (
    <main className="login-screen">
      <div className="login-ambient" aria-hidden="true" />
      <div className="login-box">
        <FormeBrand large subtitle="WARDROBE ATELIER" />
        <p className="eyebrow">A WARDROBE, IN GOOD ORDER</p>
        <h1>Dress like<br/><em>yourself.</em></h1>
        <p className="muted">A quieter way to know what you own, find what works, and get dressed with intention.</p>
        <button className="button primary full login-cta" onClick={()=>router.push("/login")}>
          <Sparkles size={16}/> Continue to sign in <ArrowRight size={15}/>
        </button>
        <p className="login-foot">Your wardrobe is private to your account.</p>
      </div>
    </main>
  );
  if (syncError)
    return (
      <main className="auth-loading">
        <div className="error-card">
          <FormeMark size={38} />
          <h2>Account connection failed</h2>
          <p>{syncError}</p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "center" }}>
            <button className="button primary" onClick={() => window.location.reload()}>
              Retry connection
            </button>
            <button className="button secondary" onClick={() => signOut()}>
              Return to sign in
            </button>
          </div>
        </div>
      </main>
    );

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"mobile-open":""}`}>
      <div className="brand">
        <button className="brand-button" onClick={()=>{router.push("/dashboard");setMobileNav(false)}}>
          <FormeBrand subtitle="ATELIER" />
        </button>
        <button className="icon-button close-nav" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={17}/></button>
      </div>
      <div className="side-label">YOUR ATELIER</div>
      <nav>
        {navigation.map(({href,label,icon:Icon})=>(
          <button
            key={href}
            className={`nav-link ${pathname===href||(href==="/dashboard"&&isDashboard)?"active":""}`}
            onClick={()=>{router.push(href);setMobileNav(false)}}
          >
            <Icon size={17} strokeWidth={1.7}/>
            <span>{label}</span>
            {href==="/wardrobe/add"&&<span className="nav-shortcut">+</span>}
            {href==="/wardrobe"&&(pageData.total||0)>0&&<span className="nav-count">{pageData.total}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="side-note"><span className="status-dot"/>Your closet, always in season</div>
        <button className="profile-row" onClick={()=>{router.push("/settings");setMobileNav(false)}}>
          <span className="avatar">{profile?.display_name?.slice(0,1)||"F"}</span>
          <span className="profile-copy">
            <strong>{profile?.display_name||"Your profile"}</strong>
            <small>{profile?.email||"Account settings"}</small>
          </span>
          <ChevronDown size={14}/>
        </button>
      </div>
    </aside>
    {mobileNav&&<button className="nav-backdrop" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu size={19}/></button>
        <div className="breadcrumb">
          <span className="breadcrumb-root" onClick={()=>router.push("/dashboard")}>FORME</span>
          <span className="breadcrumb-sep">/</span>
          <strong>{pageName}</strong>
        </div>
        <div className="top-actions">
          {weather && (
            <span className="topbar-weather" title={`Feels like ${Math.round(weather.feels_like)}°`}>
              <CloudSun size={14} /> {weatherTemp}{weatherUnit}
            </span>
          )}
          <span className="today-date">{displayDate}</span>
          <button className="avatar top-avatar" aria-label="Account settings" onClick={()=>router.push("/settings")}>
            {profile?.display_name?.slice(0,1)||"F"}
          </button>
        </div>
      </header>
      <div className="page-content">
        {error&&<div className="alert error"><CircleHelp size={16}/><span>{error}</span><button className="text-button" onClick={()=>{setError("");refresh()}}>Try again</button><button className="icon-button" onClick={()=>setError("")} aria-label="Dismiss"><X size={15}/></button></div>}
        {notice&&<div className="alert success"><CheckCircle2 size={16}/><span>{notice}</span><button className="icon-button" onClick={()=>setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}

        {isDashboard&&<>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{displayDate.toUpperCase()}</p>
              <h1>Good {new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, <em>{profile?.display_name?.split(" ")[0]||"there"}.</em></h1>
              <p className="muted">A quiet overview of your wardrobe and today’s styling inspiration.</p>
            </div>
            {weather ? (
              <div className="weather-chip">
                <CloudSun size={19}/>
                <div>
                  <strong>{weatherTemp}{weatherUnit}</strong>
                  <span>{weather.condition}</span>
                </div>
              </div>
            ) : (
              <button className="weather-chip quiet" onClick={()=>router.push("/settings")}>
                <Cloud size={17}/>
                <span>Add a location for local weather</span>
                <ArrowRight size={14}/>
              </button>
            )}
          </section>
          {loading&&!pageData.items?<Busy/>:!pageData.total?(
            <section className="empty-hero">
              <div className="empty-art">
                <div className="art-ring ring-a"/>
                <div className="art-ring ring-b"/>
                <FormeMark size={68} />
              </div>
              <div>
                <p className="eyebrow">A GOOD PLACE TO BEGIN</p>
                <h2>Your closet, <em>made clear.</em></h2>
                <p className="muted">Add a few pieces you love. FORME will catalog their colors, fabrics, and seasons, then compose effortless outfits from what you already own.</p>
                <button className="button primary" onClick={()=>router.push("/wardrobe/add")}><Plus size={16}/> Add your first piece</button>
              </div>
            </section>
          ):(
            <>
              <section className="today-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">TODAY, CONSIDERED</p>
                    <h2>A look for today</h2>
                  </div>
                  <button className="button secondary" onClick={generate} disabled={loading}>
                    <Sparkles size={15}/>{loading?"Composing look…":"Try another look"}
                  </button>
                </div>
                {recommendation ? (
                  <div className="recommendation">
                    <div className="recommendation-copy">
                      <span className="soft-badge"><Sparkles size={12}/> Curated from your wardrobe · {recommendation.occasion}</span>
                      <h3>{recommendation.name||`For ${recommendation.occasion}`}</h3>
                      <p className="muted">{recommendation.reasoning||recommendation.style_notes||"A considered combination assembled from pieces already in your collection."}</p>
                      <div className="look-items">
                        {recommendation.items?.map(item=>(
                          <button className="look-item" key={item.id} onClick={()=>{const match=pageData.items?.find(i=>i.id===item.id);if(match)setSelectedItem(match)}}>
                            <Image src={photo(item)} alt={title(item.name)}/>
                            <span>
                              <strong>{title(item.name)}</strong>
                              <small>{item.type}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="look-actions">
                        <button className="button primary" onClick={()=>setSelectedOutfit(recommendation)}>Inspect outfit <ArrowRight size={15}/></button>
                        <button className="button secondary" onClick={()=>saveOutfit(recommendation)}><Heart size={15}/> Save look</button>
                      </div>
                    </div>
                    <div className={`recommendation-visual count-${Math.min(4, recommendation.items?.length || 1)}`}>
                      {recommendation.items?.slice(0,4).map((item,i)=>(
                        <div className={`recommendation-piece piece-${i}`} key={item.id||i}>
                          <Image src={photo(item,true)} alt={title(item.name)}/>
                          <span className="piece-caption">{title(item.name)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="recommendation-empty">
                    <Sparkles size={22}/>
                    <div>
                      <strong>Ready to compose today’s look</strong>
                      <p className="muted">Generate a personalized outfit based on your pieces, style profile, and weather.</p>
                    </div>
                    <button className="button primary" onClick={generate} disabled={loading}>
                      <Sparkles size={15}/> Compose look
                    </button>
                  </div>
                )}
              </section>
              <div className="dashboard-lower">
                <section className="recent-section">
                  <div className="section-heading compact">
                    <div>
                      <p className="eyebrow">LATEST ADDITIONS</p>
                      <h2>Recently added</h2>
                    </div>
                    <button className="text-button" onClick={()=>router.push("/wardrobe")}>Browse all {pageData.total} pieces <ArrowRight size={14}/></button>
                  </div>
                  <div className="item-grid recent-grid">
                    {(pageData.items||[]).slice(0,4).map(item=><ItemTile key={item.id} item={item} onOpen={()=>setSelectedItem(item)} onFavorite={toggleFavorite}/>)}
                  </div>
                </section>
                <section className="wardrobe-summary">
                  <p className="eyebrow">ATELIER METRICS</p>
                  <strong className="summary-number">{pageData.total||0}</strong>
                  <span className="muted">cataloged pieces in your collection</span>
                  <div className="summary-rule"/>
                  <div className="summary-stats">
                    <div className="summary-stat-row">
                      <span><Activity size={14}/> Wears logged</span>
                      <strong>{pageData.wardrobe?.total_wears||0}</strong>
                    </div>
                    <div className="summary-stat-row">
                      <span><Heart size={14}/> Favorites</span>
                      <strong>{favoritesCount}</strong>
                    </div>
                    <div className="summary-stat-row">
                      <span><Layers3 size={14}/> Saved looks</span>
                      <strong>{pageData.outfits?.length||0}</strong>
                    </div>
                  </div>
                  <button className="button primary full" onClick={()=>router.push("/wardrobe/add")}><Plus size={15}/> Add clothing</button>
                </section>
              </div>
            </>
          )}
        </>}
        {isDashboard&&<AnalyticsSummary colors={pageData.color_distribution}/>}

        {isAdd&&<>
          <div className="page-heading">
            <div>
              <p className="eyebrow">ARCHIVE GARMENTS</p>
              <h1>Add <em>clothing</em></h1>
              <p className="muted">Upload up to 50 photos. FORME automatically cleans backgrounds, optimizes imagery, and extracts style attributes with AI.</p>
            </div>
            <button className="text-button" onClick={()=>router.push("/wardrobe")}>Back to wardrobe <ArrowRight size={14}/></button>
          </div>

          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            hidden
            onChange={e => { handleFiles(e.target.files); if (e.target) e.target.value = ""; }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={e => { handleFiles(e.target.files); if (e.target) e.target.value = ""; }}
          />

          <section
            className={`upload-zone ${dragging ? "dragging" : ""} ${uploadFiles.length > 0 ? "has-files" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            {uploadFiles.length > 0 ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "0 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="soft-badge">{uploadFiles.length} / 50 piece{uploadFiles.length > 1 ? "s" : ""} selected</span>
                    <small className="muted">Total ~{(uploadFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB</small>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => galleryRef.current?.click()}
                      disabled={uploading || uploadFiles.length >= 50}
                    >
                      <Plus size={13} /> Add more photos
                    </button>
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() => { setUploadFiles([]); if (galleryRef.current) galleryRef.current.value = ""; }}
                      disabled={uploading}
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                <div className="upload-multi-grid">
                  {uploadFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="upload-thumb-card">
                      <img src={URL.createObjectURL(file)} alt={file.name} />
                      <span className="thumb-badge">{(file.size / (1024 * 1024)).toFixed(1)}MB</span>
                      {!uploading && (
                        <button
                          type="button"
                          className="thumb-remove"
                          title="Remove photo"
                          onClick={e => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {uploadFiles.length < 50 && !uploading && (
                    <button
                      type="button"
                      className="upload-add-tile"
                      onClick={() => galleryRef.current?.click()}
                      title="Add more photos"
                    >
                      <Plus size={20} />
                      <span>Add photo</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <span className="upload-icon"><Upload size={22}/></span>
                <h2>Upload clothing photos</h2>
                <p className="muted">Select up to 50 garments from your photo library or take a photo</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginTop: "4px" }}>
                  <button type="button" className="button primary" onClick={() => galleryRef.current?.click()}>
                    <ImageIcon size={15} /> Choose from Photos (up to 50)
                  </button>
                  <button type="button" className="button secondary" onClick={() => cameraRef.current?.click()}>
                    <Camera size={15} /> Take a Photo
                  </button>
                </div>
                <span className="file-hint">JPEG, PNG, WebP or HEIC · Max 50 items · Canvas-optimized before upload</span>
              </>
            )}
          </section>

          {uploadProgress && (
            <div className="upload-progress-container">
              <div className="upload-progress-bar-bg">
                <div
                  className="upload-progress-bar-fill"
                  style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                />
              </div>
              <div className="upload-progress-label">
                <span><strong>Piece {uploadProgress.current} of {uploadProgress.total}</strong> · {uploadProgress.stage}</span>
                <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
            </div>
          )}

          <div className="upload-bottom">
            <div className="process-note">
              <Sparkles size={18}/>
              <span>
                <strong>Automated Background Removal & AI Vision Tagging</strong>
                <small>Clean studio backdrop generated automatically. Category, colors, pattern, fabric, and season detected by AI.</small>
              </span>
            </div>
            <button
              className="button primary"
              disabled={uploadFiles.length === 0 || uploading}
              onClick={upload}
            >
              {uploading ? (
                <><LoaderCircle size={15} className="spin"/> Cataloging {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : "..."}</>
              ) : (
                <>Add {uploadFiles.length > 0 ? `${uploadFiles.length} piece${uploadFiles.length > 1 ? "s" : ""}` : "to wardrobe"} <ArrowRight size={15}/></>
              )}
            </button>
          </div>
          <div className="photo-tips">
            <div><Check size={15}/> Natural, even lighting</div>
            <div><Check size={15}/> One garment per frame</div>
            <div><Check size={15}/> Background is cleaned automatically</div>
          </div>
        </>}

        {isWardrobe&&<>
          <div className="page-heading wardrobe-heading">
            <div>
              <p className="eyebrow">YOUR PERSONAL COLLECTION</p>
              <h1>My wardrobe <span className="count-badge">{pageData.total??"—"}</span></h1>
              <p className="muted">Every garment you own, organized and searchable.</p>
            </div>
            <button className="button primary" onClick={()=>router.push("/wardrobe/add")}><Plus size={16}/> Add clothing</button>
          </div>
          <div className="wardrobe-toolbar">
            <label className="search-box">
              <Search size={16}/>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, color, brand, or type…" aria-label="Search wardrobe"/>
              {search ? (
                <button className="icon-button search-clear" onClick={()=>setSearch("")} aria-label="Clear search"><X size={13}/></button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
            <button className={`filter-button ${favoriteOnly?"filter-active":""}`} onClick={()=>setFavoriteOnly(!favoriteOnly)}>
              <Heart size={14} fill={favoriteOnly?"currentColor":"none"}/> Favorites
            </button>
            <select className="filter-select" aria-label="Filter by color" value={colorFilter} onChange={e=>setColorFilter(e.target.value)}>
              <option value="">Any color</option>
              {Array.from(new Set((pageData.items||[]).flatMap(i=>i.colors||[]))).map(c=><option key={c} value={c.toLowerCase()}>{c}</option>)}
            </select>
            <select className="filter-select" aria-label="Filter by season" value={seasonFilter} onChange={e=>setSeasonFilter(e.target.value)}>
              <option value="">Any season</option>
              {Array.from(new Set((pageData.items||[]).flatMap(i=>i.season||i.tags?.season||[]))).map(s=><option key={s} value={String(s).toLowerCase()}>{s}</option>)}
            </select>
            <div className="toolbar-spacer"/>
            {(category !== "all" || favoriteOnly || colorFilter || seasonFilter || search) && (
              <button className="text-button" onClick={()=>{setCategory("all");setFavoriteOnly(false);setColorFilter("");setSeasonFilter("");setSearch("")}} title="Reset filters">
                <SlidersHorizontal size={14}/> Reset
              </button>
            )}
          </div>
          <div className="category-tabs">
            {["all","tops","bottoms","outerwear","one piece","shoes","accessories"].map(cat=>(
              <button key={cat} className={category===cat?"selected":""} onClick={()=>setCategory(cat)}>
                <span>{cat[0].toUpperCase()+cat.slice(1)}</span>
                {categoryCounts[cat] > 0 && <small className="tab-count">{categoryCounts[cat]}</small>}
              </button>
            ))}
          </div>
          {loading&&!pageData.items?<Busy/>:filteredItems.length?(
            <div className="item-grid wardrobe-grid">
              {filteredItems.map(item=><ItemTile key={item.id} item={item} onOpen={()=>setSelectedItem(item)} onFavorite={toggleFavorite}/>)}
            </div>
          ):(
            <div className="empty-state">
              <Shirt size={28}/>
              <h2>{pageData.total?"Nothing matches those filters":"Your wardrobe is waiting"}</h2>
              <p className="muted">{pageData.total?"Try broadening your search or resetting active filters.":"Add your first piece and start building a digital closet that feels like you."}</p>
              {pageData.total?(
                <button className="button secondary" onClick={()=>{setSearch("");setCategory("all");setFavoriteOnly(false);setColorFilter("");setSeasonFilter("")}}>Clear all filters</button>
              ):(
                <button className="button primary" onClick={()=>router.push("/wardrobe/add")}><Plus size={15}/> Add clothing</button>
              )}
            </div>
          )}
        </>}

        {isStylist&&<>
          <div className="page-heading">
            <div>
              <p className="eyebrow">A LITTLE HELP, WELL CONSIDERED</p>
              <h1>Your personal <em>stylist</em></h1>
              <p className="muted">Discover thoughtful combinations composed from the pieces you already own.</p>
            </div>
            <span className="ai-mark"><Sparkles size={14}/> AI Atelier</span>
          </div>
          <section className="stylist-controls">
            <div>
              <label htmlFor="occasion">What’s the occasion?</label>
              <select id="occasion" value={occasion} onChange={e=>setOccasion(e.target.value)}>
                {OCCASIONS.map(x=><option key={x} value={x}>{x.split("-").map(v=>v[0].toUpperCase()+v.slice(1)).join(" ")}</option>)}
              </select>
            </div>
            <div className="stylist-context">
              <Sun size={16}/>
              <span>{weather?`${weatherTemp}${weatherUnit} · ${weather.condition}`:profile?.location_name?"Weather unavailable":"Set a location in Preferences for weather-aware looks"}</span>
            </div>
            <button className="button primary" onClick={generate} disabled={loading||!pageData.total}>
              <Sparkles size={16}/>{loading?"Composing your look…":"Generate an outfit"}
            </button>
          </section>
          {!pageData.total?(
            <div className="empty-state">
              <Shirt size={28}/>
              <h2>Start with what you own</h2>
              <p className="muted">Add a few garments to your wardrobe before asking your stylist to compose a look.</p>
              <button className="button primary" onClick={()=>router.push("/wardrobe/add")}><Plus size={15}/> Add clothing</button>
            </div>
          ):recommendation?(
            <section className="stylist-result">
              <div className="result-title">
                <div>
                  <p className="eyebrow">CURATED FOR {recommendation.occasion.toUpperCase()}</p>
                  <h2>{recommendation.name||`A ${recommendation.occasion} look`}</h2>
                </div>
                <button className="button secondary" onClick={()=>generate()} disabled={loading}>
                  <Sparkles size={15}/> Try another
                </button>
              </div>
              <div className="result-composition">
                {recommendation.items?.map(item=>(
                  <div key={item.id} className="result-piece" onClick={()=>{const match=pageData.items?.find(i=>i.id===item.id);if(match)setSelectedItem(match)}}>
                    <Image src={photo(item,true)} alt={title(item.name)}/>
                    <span>{title(item.name)}</span>
                    <small>{item.type}</small>
                  </div>
                ))}
              </div>
              {recommendation.reasoning&&<p className="stylist-reasoning">{recommendation.reasoning}</p>}
              <div className="look-actions">
                <button className="button primary" onClick={()=>saveOutfit(recommendation)}><Heart size={15}/> Save this look</button>
                <button className="button secondary" onClick={()=>setSelectedOutfit(recommendation)}>Inspect & rate</button>
              </div>
            </section>
          ):(
            <div className="empty-state">
              <Sparkles size={28}/>
              <h2>Ready when you are</h2>
              <p className="muted">Choose an occasion above, then let your stylist compose a cohesive look from your actual wardrobe.</p>
              <button className="button primary" onClick={generate} disabled={loading}><Sparkles size={15}/> Generate an outfit</button>
            </div>
          )}
        </>}

        {isOutfits&&<>
          <div className="page-heading">
            <div>
              <p className="eyebrow">THE LOOKS THAT WORK</p>
              <h1>Saved <em>outfits</em> <span className="count-badge">{pageData.outfits?.length||0}</span></h1>
              <p className="muted">Your curated archive of combinations and styling notes.</p>
            </div>
            <button className="button primary" onClick={()=>router.push("/stylist")}><Sparkles size={15}/> Compose new look</button>
          </div>
          {loading&&!pageData.outfits?<Busy/>:pageData.outfits?.length?(
            <div className="outfit-grid">
              {pageData.outfits.map(outfit=><OutfitCard key={outfit.id} outfit={outfit} onOpen={()=>setSelectedOutfit(outfit)}/>)}
            </div>
          ):(
            <div className="empty-state">
              <Layers3 size={28}/>
              <h2>Your lookbook will live here</h2>
              <p className="muted">Save an outfit from your stylist to keep combinations you want to wear again.</p>
              <button className="button primary" onClick={()=>router.push("/stylist")}><Sparkles size={15}/> Open AI stylist</button>
            </div>
          )}
        </>}

        {isSettings&&<>
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAKE IT FEEL LIKE YOU</p>
              <h1>Atelier <em>preferences</em></h1>
              <p className="muted">Your profile, local weather coordinates, styling sensibilities, and household sharing.</p>
            </div>
          </div>
          {profile&&preferences?(
            <div className="settings-layout">
              <section className="settings-section">
                <div className="settings-title">
                  <div className="avatar settings-avatar">{profile.display_name?.slice(0,1)||"F"}</div>
                  <div>
                    <h2>Your profile</h2>
                    <p className="muted">The personal identity connected to your wardrobe.</p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>Display name<input value={profile.display_name||""} onChange={e=>setProfile({...profile,display_name:e.target.value})}/></label>
                  <label>Email address<input value={profile.email||""} disabled/></label>
                  <label>Location<input value={profile.location_name||""} placeholder="City or town (e.g., Paris, New York)" onChange={e=>setProfile({...profile,location_name:e.target.value})}/><small>Used to tailor daily outfits to local weather conditions.</small></label>
                  <label>Temperature unit<select value={preferences.temperature_unit} onChange={e=>setPreferences({...preferences,temperature_unit:e.target.value})}><option value="celsius">Celsius (°C)</option><option value="fahrenheit">Fahrenheit (°F)</option></select></label>
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-title">
                  <div className="setting-icon"><Sparkles size={17}/></div>
                  <div>
                    <h2>Styling preferences</h2>
                    <p className="muted">Your stylist keeps these principles in mind when composing looks.</p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>Default occasion<select value={preferences.default_occasion} onChange={e=>setPreferences({...preferences,default_occasion:e.target.value})}>{OCCASIONS.map(x=><option key={x} value={x}>{x.split("-").map(v=>v[0].toUpperCase()+v.slice(1)).join(" ")}</option>)}</select></label>
                  <label>Layering preference<select value={preferences.layering_preference} onChange={e=>setPreferences({...preferences,layering_preference:e.target.value})}><option value="minimal">Light & minimal</option><option value="moderate">Balanced</option><option value="heavy">Structured layers</option></select></label>
                  <label>Rotation variety<select value={preferences.variety_level} onChange={e=>setPreferences({...preferences,variety_level:e.target.value})}><option value="low">Signature staples</option><option value="moderate">Balanced rotation</option><option value="high">Surprise me</option></select></label>
                  <label className="check-setting"><input type="checkbox" checked={preferences.prefer_underused_items} onChange={e=>setPreferences({...preferences,prefer_underused_items:e.target.checked})}/> Prioritize under-worn pieces in recommendations</label>
                </div>
                <div className="settings-actions">
                  <button className="button secondary" onClick={()=>signOut()}><LogOut size={15}/> Sign out</button>
                  <button className="button primary" onClick={saveSettings} disabled={saving}>{saving?<><LoaderCircle size={15} className="spin"/> Saving…</>:<>Save profile & preferences <Check size={15}/></>}</button>
                </div>
              </section>
              {token && <SettingsExtras/>}
            </div>
          ):loading?<Busy/>:(
            <div className="empty-state">
              <p>Could not load preferences.</p>
              <button className="button secondary" onClick={refresh}>Retry</button>
            </div>
          )}
        </>}
      </div>
    </main>

    {selectedItem&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedItem(null)}}>
      <section className="detail-modal" role="dialog" aria-modal="true" aria-label="Clothing details">
        <button className="icon-button modal-close" onClick={()=>setSelectedItem(null)} aria-label="Close"><X size={18}/></button>
        <div className="detail-image">
          <Image src={photo(selectedItem,true)} alt={title(selectedItem.name)}/>
        </div>
        <div className="detail-fields">
          <p className="eyebrow">GARMENT ARCHIVE · {(selectedItem.tagging_status||selectedItem.status||"ready").toUpperCase()}</p>
          <h2>{title(selectedItem.name)}</h2>
          <label>Name<input value={editForm.name||""} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></label>
          <div className="two-fields">
            <label>Category<input value={editForm.type||""} onChange={e=>setEditForm({...editForm,type:e.target.value})}/></label>
            <label>Subtype<input value={editForm.subtype||""} onChange={e=>setEditForm({...editForm,subtype:e.target.value})}/></label>
          </div>
          <label>Brand / Maker<input value={editForm.brand||""} onChange={e=>setEditForm({...editForm,brand:e.target.value})}/></label>
          <label>Colors<input value={editForm.colors||""} onChange={e=>setEditForm({...editForm,colors:e.target.value})}/></label>
          <div className="two-fields">
            <label>Pattern<input value={editForm.tags?.pattern||""} onChange={e=>setEditForm({...editForm,tags:{...editForm.tags,pattern:e.target.value||null}})}/></label>
            <label>Material<input value={editForm.tags?.material||""} onChange={e=>setEditForm({...editForm,tags:{...editForm.tags,material:e.target.value||null}})}/></label>
          </div>
          <label>Style tags<input value={editForm.tags?.styleText||""} onChange={e=>setEditForm({...editForm,tags:{...editForm.tags,styleText:e.target.value}})}/></label>
          <label>Seasons<input value={editForm.tags?.seasonText||""} onChange={e=>setEditForm({...editForm,tags:{...editForm.tags,seasonText:e.target.value}})}/></label>
          <label>Notes<textarea rows={2} value={editForm.notes||""} onChange={e=>setEditForm({...editForm,notes:e.target.value})}/></label>
          <div className="activity-actions">
            <button className="button secondary" onClick={()=>logItemActivity("wear")}>Log wear</button>
            <button className="button secondary" onClick={()=>logItemActivity("wash")}>Log wash</button>
            <button className="button secondary" onClick={findPairings} disabled={pairingsLoading}><Sparkles size={13}/>{pairingsLoading?"Finding…":"Pair with"}</button>
            <span className="muted">Worn {selectedItem.wear_count||0}×</span>
          </div>
          {pairings.length>0&&(
            <div className="pairing-results">
              <strong>Complementary combinations</strong>
              {pairings.map(p=>(
                <button key={p.id} className="pairing-row" onClick={()=>{setSelectedItem(null);setSelectedOutfit(p)}}>
                  <span>{p.items?.map(x=>title(x.name)).join(" + ")}</span>
                  <ArrowRight size={14}/>
                </button>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button className="text-button danger-text" onClick={deleteItem}><Archive size={15}/> Remove piece</button>
            <button className="button primary" onClick={saveItem} disabled={saving}>{saving?"Saving…":"Save changes"}</button>
          </div>
        </div>
      </section>
    </div>}

    {selectedOutfit&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedOutfit(null)}}>
      <section className="outfit-modal" role="dialog" aria-modal="true" aria-label="Outfit details">
        <button className="icon-button modal-close" onClick={()=>setSelectedOutfit(null)} aria-label="Close"><X size={18}/></button>
        <p className="eyebrow">{selectedOutfit.occasion.toUpperCase()} · {selectedOutfit.status.toUpperCase()}</p>
        <h2>{selectedOutfit.name||"A considered look"}</h2>
        <div className="outfit-detail-items">
          {selectedOutfit.items?.map((item,i)=>(
            <div key={item.id||i}>
              <Image src={photo(item,true)} alt={title(item.name)}/>
              <span>{title(item.name)}</span>
              <small>{item.type}</small>
            </div>
          ))}
        </div>
        {selectedOutfit.reasoning&&<p className="muted outfit-explanation">{selectedOutfit.reasoning}</p>}
        <div className="outfit-feedback">
          <span>How did this combination feel?</span>
          <div>
            {[1,2,3,4,5].map(r=>(
              <button
                key={r}
                className={`rating-button ${(selectedOutfit.feedback?.rating||0)>=r?"rated":""}`}
                aria-label={`Rate ${r} out of 5`}
                onClick={()=>outfitFeedback(selectedOutfit,{rating:r},"Thanks for rating this look.")}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="outfit-modal-actions">
          {selectedOutfit.status!=="accepted"&&<button className="button primary" onClick={()=>saveOutfit(selectedOutfit)}><Heart size={15}/> Save look</button>}
          <button className="button secondary" onClick={()=>outfitFeedback(selectedOutfit,{worn:true,actually_worn:true},"Wear recorded.")}><Check size={15}/> Mark as worn today</button>
        </div>
      </section>
    </div>}

    <nav className="mobile-bottom-nav">
      {navigation.slice(0,5).map(({href,label,icon:Icon})=>(
        <button key={href} onClick={()=>router.push(href)} className={pathname===href||(href==="/dashboard"&&isDashboard)?"active":""}>
          <Icon size={19}/>
          <span>{label.replace("My ","")}</span>
        </button>
      ))}
    </nav>
  </div>;
}
